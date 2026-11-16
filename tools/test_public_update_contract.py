import unittest
from public_update_contract import public_update_contract

class PublicUpdateContract(unittest.TestCase):
    def test_projection_is_safe_and_idempotent(self):
        original = {'info': {'description': '功能。新增应用更新三操作；internal-details'},
            'paths': {'/update': {'get': {'responses': {'200': {'description': '状态'}}}},
                      '/update/package': {'post': {'description': 'internal-details', 'responses': {'422': {'description': 'internal-details'}}}},
                      '/vio': {'get': {'description': 'unchanged'}}},
            'components': {'schemas': {'UpdatePackageMetadata': {'type': 'object', 'additionalProperties': False,
                'required': ['version', 'internal_field'], 'properties': {'version': {'type': 'string'}, 'internal_field': {'type': 'string'}}}}}}
        result = public_update_contract(original)
        self.assertNotIn('internal-details', str(result))
        schema = result['components']['schemas']['UpdatePackageMetadata']
        self.assertEqual(set(schema['properties']), {'version'})
        self.assertTrue(schema['additionalProperties'])
        self.assertEqual(result['paths']['/vio'], original['paths']['/vio'])
        self.assertEqual(result, public_update_contract(result))
        self.assertIn('internal_field', original['components']['schemas']['UpdatePackageMetadata']['properties'])

if __name__ == '__main__':
    unittest.main()
