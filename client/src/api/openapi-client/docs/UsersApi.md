# UsersApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createUserEndpointUsersPost**](UsersApi.md#createuserendpointuserspost) | **POST** /users | Create User Endpoint |
| [**deleteUserEndpointUsersUserIdDelete**](UsersApi.md#deleteuserendpointusersuseriddelete) | **DELETE** /users/{user_id} | Delete User Endpoint |
| [**getUserEndpointUsersUserIdGet**](UsersApi.md#getuserendpointusersuseridget) | **GET** /users/{user_id} | Get User Endpoint |
| [**getUsersMeUsersMeGet**](UsersApi.md#getusersmeusersmeget) | **GET** /users/me | Get Users Me |
| [**listUsersEndpointUsersGet**](UsersApi.md#listusersendpointusersget) | **GET** /users | List Users Endpoint |
| [**updateUserEndpointUsersUserIdPatch**](UsersApi.md#updateuserendpointusersuseridpatch) | **PATCH** /users/{user_id} | Update User Endpoint |



## createUserEndpointUsersPost

> UserRead createUserEndpointUsersPost(userCreate)

Create User Endpoint

Create a user.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { CreateUserEndpointUsersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // UserCreate
    userCreate: ...,
  } satisfies CreateUserEndpointUsersPostRequest;

  try {
    const data = await api.createUserEndpointUsersPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userCreate** | [UserCreate](UserCreate.md) |  | |

### Return type

[**UserRead**](UserRead.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteUserEndpointUsersUserIdDelete

> deleteUserEndpointUsersUserIdDelete(userId)

Delete User Endpoint

Delete a user.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { DeleteUserEndpointUsersUserIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteUserEndpointUsersUserIdDeleteRequest;

  try {
    const data = await api.deleteUserEndpointUsersUserIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUserEndpointUsersUserIdGet

> UserRead getUserEndpointUsersUserIdGet(userId)

Get User Endpoint

Get a user.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetUserEndpointUsersUserIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetUserEndpointUsersUserIdGetRequest;

  try {
    const data = await api.getUserEndpointUsersUserIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**UserRead**](UserRead.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUsersMeUsersMeGet

> UserRead getUsersMeUsersMeGet()

Get Users Me

Return the authenticated user\&#39;s profile.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { GetUsersMeUsersMeGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

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

[**UserRead**](UserRead.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listUsersEndpointUsersGet

> Array&lt;UserRead&gt; listUsersEndpointUsersGet()

List Users Endpoint

List users.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { ListUsersEndpointUsersGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  try {
    const data = await api.listUsersEndpointUsersGet();
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

[**Array&lt;UserRead&gt;**](UserRead.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateUserEndpointUsersUserIdPatch

> UserRead updateUserEndpointUsersUserIdPatch(userId, userUpdate)

Update User Endpoint

Update a user.

### Example

```ts
import {
  Configuration,
  UsersApi,
} from '';
import type { UpdateUserEndpointUsersUserIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new UsersApi();

  const body = {
    // string
    userId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UserUpdate
    userUpdate: ...,
  } satisfies UpdateUserEndpointUsersUserIdPatchRequest;

  try {
    const data = await api.updateUserEndpointUsersUserIdPatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **userId** | `string` |  | [Defaults to `undefined`] |
| **userUpdate** | [UserUpdate](UserUpdate.md) |  | |

### Return type

[**UserRead**](UserRead.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

