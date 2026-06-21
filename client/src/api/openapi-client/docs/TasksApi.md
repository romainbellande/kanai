# TasksApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createTaskEndpointProjectsProjectIdTasksPost**](TasksApi.md#createtaskendpointprojectsprojectidtaskspost) | **POST** /projects/{project_id}/tasks | Create Task Endpoint |
| [**deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete**](TasksApi.md#deletetaskendpointprojectsprojectidtaskstaskiddelete) | **DELETE** /projects/{project_id}/tasks/{task_id} | Delete Task Endpoint |
| [**getTaskEndpointProjectsProjectIdTasksTaskIdGet**](TasksApi.md#gettaskendpointprojectsprojectidtaskstaskidget) | **GET** /projects/{project_id}/tasks/{task_id} | Get Task Endpoint |
| [**listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet**](TasksApi.md#listactivesprinttasksendpointprojectsprojectidtasksactivesprintget) | **GET** /projects/{project_id}/tasks/active-sprint | List Active Sprint Tasks Endpoint |
| [**listTasksEndpointProjectsProjectIdTasksGet**](TasksApi.md#listtasksendpointprojectsprojectidtasksget) | **GET** /projects/{project_id}/tasks | List Tasks Endpoint |
| [**moveTaskEndpointProjectsProjectIdTasksTaskIdMovePut**](TasksApi.md#movetaskendpointprojectsprojectidtaskstaskidmoveput) | **PUT** /projects/{project_id}/tasks/{task_id}/move | Move Task Endpoint |
| [**updateTaskEndpointProjectsProjectIdTasksTaskIdPatch**](TasksApi.md#updatetaskendpointprojectsprojectidtaskstaskidpatch) | **PATCH** /projects/{project_id}/tasks/{task_id} | Update Task Endpoint |



## createTaskEndpointProjectsProjectIdTasksPost

> TaskRead createTaskEndpointProjectsProjectIdTasksPost(projectId, taskCreate)

Create Task Endpoint

Create a task in a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { CreateTaskEndpointProjectsProjectIdTasksPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // TaskCreate
    taskCreate: ...,
  } satisfies CreateTaskEndpointProjectsProjectIdTasksPostRequest;

  try {
    const data = await api.createTaskEndpointProjectsProjectIdTasksPost(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **taskCreate** | [TaskCreate](TaskCreate.md) |  | |

### Return type

[**TaskRead**](TaskRead.md)

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


## deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete

> deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete(projectId, taskId)

Delete Task Endpoint

Delete a task from a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { DeleteTaskEndpointProjectsProjectIdTasksTaskIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    taskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteTaskEndpointProjectsProjectIdTasksTaskIdDeleteRequest;

  try {
    const data = await api.deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **taskId** | `string` |  | [Defaults to `undefined`] |

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


## getTaskEndpointProjectsProjectIdTasksTaskIdGet

> TaskRead getTaskEndpointProjectsProjectIdTasksTaskIdGet(projectId, taskId)

Get Task Endpoint

Get a single task from a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { GetTaskEndpointProjectsProjectIdTasksTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    taskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetTaskEndpointProjectsProjectIdTasksTaskIdGetRequest;

  try {
    const data = await api.getTaskEndpointProjectsProjectIdTasksTaskIdGet(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **taskId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**TaskRead**](TaskRead.md)

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


## listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet

> Array&lt;TaskRead&gt; listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet(projectId)

List Active Sprint Tasks Endpoint

List tasks selected into the project\&#39;s active sprint.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { ListActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGetRequest;

  try {
    const data = await api.listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;TaskRead&gt;**](TaskRead.md)

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


## listTasksEndpointProjectsProjectIdTasksGet

> Array&lt;TaskRead&gt; listTasksEndpointProjectsProjectIdTasksGet(projectId, title, limit, excludeTaskId)

List Tasks Endpoint

List tasks for a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { ListTasksEndpointProjectsProjectIdTasksGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    title: title_example,
    // number (optional)
    limit: 56,
    // string (optional)
    excludeTaskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListTasksEndpointProjectsProjectIdTasksGetRequest;

  try {
    const data = await api.listTasksEndpointProjectsProjectIdTasksGet(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **limit** | `number` |  | [Optional] [Defaults to `undefined`] |
| **excludeTaskId** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;TaskRead&gt;**](TaskRead.md)

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


## moveTaskEndpointProjectsProjectIdTasksTaskIdMovePut

> TaskRead moveTaskEndpointProjectsProjectIdTasksTaskIdMovePut(projectId, taskId, taskDestination)

Move Task Endpoint

Move a task to a board destination accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { MoveTaskEndpointProjectsProjectIdTasksTaskIdMovePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    taskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // TaskDestination
    taskDestination: ...,
  } satisfies MoveTaskEndpointProjectsProjectIdTasksTaskIdMovePutRequest;

  try {
    const data = await api.moveTaskEndpointProjectsProjectIdTasksTaskIdMovePut(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **taskId** | `string` |  | [Defaults to `undefined`] |
| **taskDestination** | [TaskDestination](TaskDestination.md) |  | |

### Return type

[**TaskRead**](TaskRead.md)

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


## updateTaskEndpointProjectsProjectIdTasksTaskIdPatch

> TaskRead updateTaskEndpointProjectsProjectIdTasksTaskIdPatch(projectId, taskId, taskUpdate)

Update Task Endpoint

Update a task in a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  TasksApi,
} from '';
import type { UpdateTaskEndpointProjectsProjectIdTasksTaskIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new TasksApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    taskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // TaskUpdate
    taskUpdate: ...,
  } satisfies UpdateTaskEndpointProjectsProjectIdTasksTaskIdPatchRequest;

  try {
    const data = await api.updateTaskEndpointProjectsProjectIdTasksTaskIdPatch(body);
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
| **projectId** | `string` |  | [Defaults to `undefined`] |
| **taskId** | `string` |  | [Defaults to `undefined`] |
| **taskUpdate** | [TaskUpdate](TaskUpdate.md) |  | |

### Return type

[**TaskRead**](TaskRead.md)

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

