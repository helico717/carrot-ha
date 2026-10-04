"""Exercise the real WS write handler with a durable archive and HA adapter."""
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest
from test_charge_payments import ChargePaymentsTest, PaymentConflict
from custom_components.carrot_ha.charge_costs import refresh_runtime_costs


class ChargePaymentAPITest(ChargePaymentsTest, unittest.IsolatedAsyncioTestCase):
    async def test_admin_isolation_validation_and_ack(self):
        self.charge()
        data = self.data()
        tree = ast.parse(Path('custom_components/carrot_ha/charge_ws.py').read_text())
        tree.body = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == '_write']
        notifications = []
        ns = dict(PaymentConflict=PaymentConflict, refresh_runtime_costs=refresh_runtime_costs,
                  async_dispatcher_send=lambda *args: notifications.append(args))
        exec(compile(tree, 'charge_ws.py', 'exec'), ns)
        async def executor(fn, *args):
            return fn(*args)
        entry = SimpleNamespace(entry_id='entry', data={'device_id':'car'})
        runtime = dict(entry=entry, archive=self.archive, lock=asyncio.Lock())
        hass = SimpleNamespace(config=SimpleNamespace(time_zone='Asia/Seoul'),
                               data={'carrot_ha': {'entry':runtime}}, async_add_executor_job=executor)
        replies = []
        connection = SimpleNamespace(user=SimpleNamespace(is_admin=False),
            send_error=lambda *args: replies.append(('error',args)), send_result=lambda *args: replies.append(('ok',args)))
        msg = dict(id=1, entry_id='entry', payment_id=data['payment_id'], source_event_ids=data['source_event_ids'], expected_version=0)
        await ns['_write'](hass, connection, msg, 1000)
        self.assertEqual(replies[-1][1][1], 'unauthorized')
        self.assertIsNone(self.data()['actual_cost_krw'])
        connection.user.is_admin = True
        await ns['_write'](hass, connection, dict(msg,entry_id='missing'), 1000)
        self.assertEqual(replies[-1][1][1], 'not_found')
        await ns['_write'](hass, connection, msg, True)
        self.assertEqual(replies[-1][1][1], 'invalid_payment')
        await ns['_write'](hass, connection, msg, 0)
        self.assertEqual(replies[-1][0], 'ok')
        self.assertEqual(self.data()['actual_cost_krw'], 0)
        self.assertEqual(len(notifications), 1)
        await ns['_write'](hass, connection, msg, 900)
        self.assertEqual(replies[-1][1][1], 'conflict')
        await ns['_write'](hass, connection, dict(msg,expected_version=1), None)
        self.assertEqual(replies[-1][0], 'ok')
        self.assertIsNone(self.data()['actual_cost_krw'])
        # A successful transaction is acknowledged even if a subsequent cache read fails.
        async def failed_refresh(*args):
            raise OSError('read failed')
        ns['refresh_runtime_costs'] = failed_refresh
        await ns['_write'](hass, connection, dict(msg,expected_version=2), 500)
        self.assertEqual(replies[-1][0], 'ok')
        self.assertEqual(self.data()['actual_cost_krw'], 500)
