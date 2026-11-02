"""Which driving software the Comma runs, from the Git checkout it reports.

The IQpilot HA candidate is installed from the `iq-ha` branch. Carrot-only features
(parameter queue, driving log transfer and screens) pause while it runs and resume
automatically once the Comma reports a Carrot branch again.
"""
IQPILOT = 'iqpilot'
CARROT = 'carrot'


def pilot_software(data):
    branch = (data or {}).get('comma_git_branch')
    if isinstance(branch, str) and (branch == 'iq-ha' or branch.startswith('iq-')):
        return IQPILOT
    return CARROT


def runtime_pilot(runtime):
    return pilot_software((runtime.get('latest') or {}).get('data'))
