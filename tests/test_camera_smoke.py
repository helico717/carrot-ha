"""Test probe ownership/cleanup without importing or starting real openpilot."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location(
    "camera_smoke", Path(__file__).parents[1] / "scripts/camera_smoke_test.py")
probe = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"fcntl": types.ModuleType("fcntl")}):
    spec.loader.exec_module(probe)


class FakeParams:
    def __init__(self, typed=False):
        self.typed = typed
        self.values = {"IsOffroad": True if typed else b"1", "IsOnroad": False if typed else b"0"}

    def get(self, name):
        return self.values.get(name)

    def get_bool(self, name):
        return probe.param_bool(self.get(name)) is True

    def put_bool(self, name, value):
        self.values[name] = bool(value) if self.typed else (b"1" if value else b"0")

    def put(self, name, value):
        self.values[name] = value

    def remove(self, name):
        self.values.pop(name, None)


class SmokeTests(unittest.TestCase):
    def test_both_supported_commits_reach_dependency_check(self):
        for commit in ('5cb0f3e590a28d0138ad9f48506f65743cdaa326',
                       '07be35fe08dbc1304e56cf186d8c33a36498fa95'):
            with self.subTest(commit=commit), \
                    patch.object(sys, 'argv', ['probe', '--vehicle-disconnected']), \
                    patch.object(probe.subprocess, 'check_output', side_effect=[
                        commit, ' M openpilot/system/manager/process_config.py\n']), \
                    patch.object(probe.shutil, 'which', return_value=None), \
                    patch.object(probe, 'run') as run:
                with self.assertRaisesRegex(SystemExit, 'GNU timeout'):
                    probe.main()
                run.assert_not_called()

    def test_unknown_commit_still_stops_before_other_checks(self):
        with patch.object(sys, 'argv', ['probe', '--vehicle-disconnected']), \
                patch.object(probe.subprocess, 'check_output', return_value='a' * 40) as git, \
                patch.object(probe, 'run') as run:
            with self.assertRaisesRegex(SystemExit, 'Different openpilot commit'):
                probe.main()
            git.assert_called_once()
            run.assert_not_called()

    def test_process_registration_edits_are_allowed(self):
        for status in (' M', 'M ', 'MM'):
            with self.subTest(status=status):
                self.assertEqual(probe.unexpected_system_changes(
                    status + ' openpilot/system/manager/process_config.py\n'), [])

    def test_allowed_registration_does_not_hide_other_changes(self):
        rejected = ' M openpilot/system/camerad/snapshot.py'
        self.assertEqual(probe.unexpected_system_changes(
            ' M openpilot/system/manager/process_config.py\n' + rejected + '\n'), [rejected])

    def test_untracked_native_binaries_are_allowed(self):
        self.assertEqual(probe.unexpected_system_changes(
            "?? openpilot/system/camerad/camerad\n"
            "?? openpilot/system/loggerd/encoderd\n"), [])

    def test_source_and_tracked_binary_changes_still_block(self):
        for line in (
            " M openpilot/system/camerad/snapshot.py",
            " D openpilot/system/manager/process_config.py",
            "D  openpilot/system/manager/process_config.py",
            "UU openpilot/system/manager/process_config.py",
            " T openpilot/system/manager/process_config.py",
            "?? openpilot/system/manager/process_config.py",
            " M openpilot/system/manager/process_config.py.backup",
            "R  openpilot/system/manager/process_config.py -> openpilot/system/manager/renamed.py",
            "M  openpilot/system/camerad/camerad",
            " D openpilot/system/loggerd/encoderd",
            "?? openpilot/system/camerad/extra.py",
            "?? openpilot/system/camerad/camerad.backup",
        ):
            with self.subTest(line=line):
                self.assertEqual(probe.unexpected_system_changes(line + "\n"), [line])

    def execute(self, *, early_exit=False, transition=False, typed=False, existing_flag=False,
                verify_decode=False, decode_error=False):
        params = FakeParams(typed=typed)
        if existing_flag:
            params.put_bool("IsTakingSnapshot", False)
        original = params.get("IsTakingSnapshot")
        sockets = {name: Mock(name=name) for name in probe.SOURCES}
        names = {id(sock): name for name, sock in sockets.items()}

        def receive(sock):
            name = names[id(sock)]
            if transition:
                params.put_bool("IsOnroad", True)
            return types.SimpleNamespace(which=lambda: name,
                                         **{name: types.SimpleNamespace(data=b"frame", header=b"header")})

        messaging = types.SimpleNamespace(
            Poller=lambda: types.SimpleNamespace(poll=lambda _: list(sockets.values())),
            sub_sock=lambda name, **_: sockets[name], recv_one_or_none=receive)
        modules = {
            "openpilot": types.ModuleType("openpilot"),
            "openpilot.common": types.ModuleType("openpilot.common"),
            "openpilot.common.params": types.SimpleNamespace(Params=lambda: params),
            "openpilot.cereal": types.SimpleNamespace(messaging=messaging),
        }
        def decode(_packet):
            if decode_error:
                raise ValueError("Invalid H.264")
            return [types.SimpleNamespace(width=1280, height=720)]
        modules["av"] = types.SimpleNamespace(CodecContext=types.SimpleNamespace(
            create=lambda *_: types.SimpleNamespace(parse=lambda data: [data], decode=decode)))
        children = [Mock(pid=80001), Mock(pid=80002)]
        for child in children:
            child.poll.return_value = 1 if early_exit else None
        fake_signals = types.SimpleNamespace(
            SIGINT=2, SIGTERM=15, SIGHUP=1, SIG_IGN=1, alarm=Mock(), signal=Mock())
        original_path = sys.path[:]
        try:
            with patch.dict(sys.modules, modules), \
                    patch.object(probe, "signal", fake_signals), \
                    patch.object(probe, "active_camera_processes", return_value=[]), \
                    patch.object(probe.time, "sleep"), \
                    patch.object(probe.subprocess, "Popen", side_effect=children), \
                    patch.object(probe, "stop_owned") as stop:
                result = probe.run(Path("/fake/openpilot"), "/usr/bin/timeout", verify_decode=verify_decode)
                self.assertEqual([call.args[0] for call in stop.call_args_list], list(reversed(children)))
        finally:
            sys.path[:] = original_path
        self.assertEqual(params.get("IsTakingSnapshot"), original)
        self.assertTrue(result["snapshot_flag_restored"])
        for sock in sockets.values():
            sock.close.assert_called_once()
        return result

    def test_success_cleans_up_and_reports_counts(self):
        result = self.execute()
        self.assertTrue(result["passed"])
        self.assertEqual(set(result["messages"].values()), {10})

    def test_decode_success_reports_both_sizes(self):
        result = self.execute(verify_decode=True, typed=True)
        self.assertTrue(result["passed"])
        self.assertEqual(len(result["frame_sizes"]), 2)
        self.assertTrue(all(n > 0 for n in result["decoded_frames"].values()))

    def test_decode_failure_still_restores_state_and_stops_children(self):
        result = self.execute(verify_decode=True, decode_error=True, typed=True)
        self.assertFalse(result["passed"])
        self.assertEqual(result["error"], "Invalid H.264")

    def test_typed_params_success_and_missing_flag_cleanup(self):
        self.assertTrue(self.execute(typed=True)["passed"])

    def test_existing_false_flag_restored_for_both_apis(self):
        for typed in (True, False):
            with self.subTest(typed=typed):
                self.assertTrue(self.execute(typed=typed, existing_flag=True)["passed"])

    def test_typed_params_transition_cleans_up(self):
        result = self.execute(typed=True, transition=True)
        self.assertFalse(result["passed"])
        self.assertIn("offroad", result["error"])

    def test_invalid_and_missing_boolean_states_are_not_false(self):
        for value in (None, b"", "false", 0, 1, [], b"garbage"):
            with self.subTest(value=value):
                self.assertIsNone(probe.param_bool(value))

    def test_child_failure_restores_original_absent_parameter(self):
        result = self.execute(early_exit=True)
        self.assertFalse(result["passed"])
        self.assertIn("exited early", result["error"])

    def test_onroad_transition_aborts_and_cleans_up(self):
        result = self.execute(transition=True)
        self.assertFalse(result["passed"])
        self.assertIn("offroad", result["error"])

    def test_missing_onroad_state_is_rejected(self):
        params = FakeParams()
        params.remove("IsOnroad")
        with self.assertRaises(RuntimeError):
            probe.require_offroad(params)


if __name__ == "__main__":
    unittest.main()
