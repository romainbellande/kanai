# UsersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getUsersMeUsersMeGet**](UsersApi.md#getusersmeusersmeget) | **GET** /users/me | Get Users Me |



## getUsersMeUsersMeGet

> any getUsersMeUsersMeGet()

Get Users Me

Return the authenticated user\&#39;s profile.  Args:     _: Bearer authorization credentials supplied by FastAPI security.  Returns:     A JSON-serializable dictionary containing the user profile fields.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetUsersMeUsersMeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new UsersApi(config);

  try {
    const data = await api.getUsersMeUsersMeGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

