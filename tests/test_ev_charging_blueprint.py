import importlib.util
from pathlib import Path
import tempfile
import unittest

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - local Python without PyYAML
    yaml = None


ROOT = Path(__file__).resolve().parent.parent
BLUEPRINT_PATH = (
    ROOT
    / "custom_components"
    / "carrot_ha"
    / "blueprints"
    / "automation"
    / "carrot_ha"
    / "ev_charging_live_activity.yaml"
)
SYNC_PATH = ROOT / "custom_components" / "carrot_ha" / "blueprint_sync.py"


if yaml is not None:
    class _InputTag(str):
        pass


    def _input_constructor(loader: yaml.SafeLoader, node: yaml.Node) -> _InputTag:
        return _InputTag(loader.construct_scalar(node))


    class _BlueprintLoader(yaml.SafeLoader):
        pass


    _BlueprintLoader.add_constructor("!input", _input_constructor)
else:
    _BlueprintLoader = None


def _load_sync_module():
    spec = importlib.util.spec_from_file_location("carrot_ha_blueprint_sync", SYNC_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class TestEvChargingBlueprint(unittest.TestCase):
    def test_blueprint_yaml_schema_and_cross_platform_fields(self):
        raw_text = BLUEPRINT_PATH.read_text(encoding="utf-8")
        self.assertIn("domain: automation", raw_text)
        self.assertIn("source_url: https://github.com/helico717/carrot-ha/", raw_text)
        self.assertIn('min_version: "2024.10.0"', raw_text)
        self.assertIn("'live_update': true", raw_text)
        self.assertIn("silent=true", raw_text)
        self.assertIn("alert_once=true", raw_text)
        self.assertIn("clear_notification", raw_text)
        self.assertIn("color_rgb: {}", raw_text)

        if yaml is None:
            return

        data = yaml.load(raw_text, Loader=_BlueprintLoader)

        bp = data["blueprint"]
        self.assertEqual(bp["domain"], "automation")
        self.assertTrue(bp["source_url"].startswith("https://github.com/helico717/carrot-ha/"))
        self.assertEqual(bp["homeassistant"]["min_version"], "2024.10.0")

        inputs = bp["input"]
        self.assertIn("vehicle_entities", inputs)
        self.assertIn("notification_targets", inputs)
        self.assertIn("display_settings", inputs)

        notif_inputs = inputs["notification_targets"]["input"]
        self.assertIn("notify_services", notif_inputs)
        self.assertIn("platform_mode", notif_inputs)
        options = [o["value"] for o in notif_inputs["platform_mode"]["selector"]["select"]["options"]]
        self.assertEqual(options, ["both", "ios", "android"])

        disp_inputs = inputs["display_settings"]["input"]
        self.assertIn("show_progress_bar", disp_inputs)
        self.assertIn("android_channel", disp_inputs)

        triggers = data["triggers"]
        battery_trigger = next(t for t in triggers if t.get("id") == "update")
        self.assertIn("to", battery_trigger)
        self.assertIsNone(battery_trigger["to"])

        eta_trigger = next(t for t in triggers if t.get("id") == "eta_recovered")
        self.assertEqual(eta_trigger["from"], ["unknown", "unavailable"])

        stop_triggers = [t for t in triggers if t.get("id") == "stop"]
        self.assertEqual(len(stop_triggers), 2)
        self.assertIn("unknown", stop_triggers[0]["to"])
        self.assertIn("unknown", stop_triggers[1]["to"])

    def test_sync_blueprints_copies_and_skips_unchanged(self):
        sync_mod = _load_sync_module()
        with tempfile.TemporaryDirectory() as tmp:
            target_dir = Path(tmp) / "blueprints"
            first = sync_mod.sync_blueprints(target_dir)
            self.assertEqual(first, ["automation/carrot_ha/ev_charging_live_activity.yaml"])
            copied = target_dir / "automation" / "carrot_ha" / "ev_charging_live_activity.yaml"
            self.assertTrue(copied.is_file())
            self.assertEqual(copied.read_bytes(), BLUEPRINT_PATH.read_bytes())

            second = sync_mod.sync_blueprints(target_dir)
            self.assertEqual(second, [])

            copied.write_text("stale", encoding="utf-8")
            third = sync_mod.sync_blueprints(target_dir)
            self.assertEqual(third, ["automation/carrot_ha/ev_charging_live_activity.yaml"])
            self.assertEqual(copied.read_bytes(), BLUEPRINT_PATH.read_bytes())


if __name__ == "__main__":
    unittest.main()
