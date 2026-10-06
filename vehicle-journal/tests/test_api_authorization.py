"""Exercise authorization before any data access without importing HA."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        tree=ast.parse(Path('custom_components/carrot_ha/vehicle_journal/api.py').read_text())
        tree.body=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='runtime']
        self.namespace={}
        exec(compile(tree,'api.py','exec'),self.namespace)
        self.errors=[]
        self.connection=SimpleNamespace(user=None,send_error=lambda *args:self.errors.append(args))
        self.hass=SimpleNamespace(data={'carrot_ha':{'entry':{'journal':object()}}})

    def test_anonymous_and_nonadmin_blocked(self):
        for user in (None,SimpleNamespace(is_admin=False)):
            self.connection.user=user
            self.assertIsNone(self.namespace['runtime'](self.hass,self.connection,{'id':1,'entry_id':'entry'}))
            self.assertEqual(self.errors[-1][1],'unauthorized')

    def test_missing_entry_blocked_admin_entry_allowed(self):
        self.connection.user=SimpleNamespace(is_admin=True)
        self.assertIsNone(self.namespace['runtime'](self.hass,self.connection,{'id':1,'entry_id':'other'}))
        self.assertEqual(self.errors[-1][1],'not_found')
        self.assertIs(self.namespace['runtime'](self.hass,self.connection,{'id':2,'entry_id':'entry'}),self.hass.data['carrot_ha']['entry'])


if __name__=='__main__':unittest.main()


class FuelUnitsTests(unittest.TestCase):
    def test_won_only_allowed_for_verified_fuel_integration(self):
        tree=ast.parse(Path('custom_components/carrot_ha/vehicle_journal/api.py').read_text())
        tree.body=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='fuel_sensor_supported']
        namespace={}
        exec(compile(tree,'api.py','exec'),namespace)
        supported=namespace['fuel_sensor_supported']
        sensor=lambda unit:SimpleNamespace(attributes={'unit_of_measurement':unit})
        self.assertTrue(supported(sensor('원'),'gas_station_korea'))
        self.assertFalse(supported(sensor('원'),'other'))
        self.assertFalse(supported(sensor('원'),None))
        self.assertTrue(supported(sensor('KRW/L'),None))
        self.assertFalse(supported(sensor('원/kWh'),'gas_station_korea'))
