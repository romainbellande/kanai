# ProjectsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addProjectMemberProjectsProjectIdMembersPost**](ProjectsApi.md#addprojectmemberprojectsprojectidmemberspost) | **POST** /projects/{project_id}/members | Add Project Member |
| [**createProjectEndpointProjectsPost**](ProjectsApi.md#createprojectendpointprojectspost) | **POST** /projects | Create Project Endpoint |
| [**createTaskEndpointProjectsProjectIdTasksPost**](ProjectsApi.md#createtaskendpointprojectsprojectidtaskspost) | **POST** /projects/{project_id}/tasks | Create Task Endpoint |
| [**deleteProjectProjectsProjectIdDelete**](ProjectsApi.md#deleteprojectprojectsprojectiddelete) | **DELETE** /projects/{project_id} | Delete Project |
| [**deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete**](ProjectsApi.md#deletetaskendpointprojectsprojectidtaskstaskiddelete) | **DELETE** /projects/{project_id}/tasks/{task_id} | Delete Task Endpoint |
| [**getProjectProjectsProjectIdGet**](ProjectsApi.md#getprojectprojectsprojectidget) | **GET** /projects/{project_id} | Get Project |
| [**getTaskEndpointProjectsProjectIdTasksTaskIdGet**](ProjectsApi.md#gettaskendpointprojectsprojectidtaskstaskidget) | **GET** /projects/{project_id}/tasks/{task_id} | Get Task Endpoint |
| [**listProjectsProjectsGet**](ProjectsApi.md#listprojectsprojectsget) | **GET** /projects | List Projects |
| [**listTasksEndpointProjectsProjectIdTasksGet**](ProjectsApi.md#listtasksendpointprojectsprojectidtasksget) | **GET** /projects/{project_id}/tasks | List Tasks Endpoint |
| [**updateProjectProjectsProjectIdPatch**](ProjectsApi.md#updateprojectprojectsprojectidpatch) | **PATCH** /projects/{project_id} | Update Project |
| [**updateTaskEndpointProjectsProjectIdTasksTaskIdPatch**](ProjectsApi.md#updatetaskendpointprojectsprojectidtaskstaskidpatch) | **PATCH** /projects/{project_id}/tasks/{task_id} | Update Task Endpoint |



## addProjectMemberProjectsProjectIdMembersPost

> ProjectRead addProjectMemberProjectsProjectIdMembersPost(projectId, projectMemberCreate)

Add Project Member

Add a member to a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { AddProjectMemberProjectsProjectIdMembersPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectMemberCreate
    projectMemberCreate: ...,
  } satisfies AddProjectMemberProjectsProjectIdMembersPostRequest;

  try {
    const data = await api.addProjectMemberProjectsProjectIdMembersPost(body);
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
| **projectMemberCreate** | [ProjectMemberCreate](ProjectMemberCreate.md) |  | |

### Return type

[**ProjectRead**](ProjectRead.md)

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


## createProjectEndpointProjectsPost

> ProjectRead createProjectEndpointProjectsPost(projectCreate)

Create Project Endpoint

Create a project for the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateProjectEndpointProjectsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // ProjectCreate
    projectCreate: ...,
  } satisfies CreateProjectEndpointProjectsPostRequest;

  try {
    const data = await api.createProjectEndpointProjectsPost(body);
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
| **projectCreate** | [ProjectCreate](ProjectCreate.md) |  | |

### Return type

[**ProjectRead**](ProjectRead.md)

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


## createTaskEndpointProjectsProjectIdTasksPost

> TaskRead createTaskEndpointProjectsProjectIdTasksPost(projectId, taskCreate)

Create Task Endpoint

Create a task in a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateTaskEndpointProjectsProjectIdTasksPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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


## deleteProjectProjectsProjectIdDelete

> deleteProjectProjectsProjectIdDelete(projectId)

Delete Project

Delete a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { DeleteProjectProjectsProjectIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteProjectProjectsProjectIdDeleteRequest;

  try {
    const data = await api.deleteProjectProjectsProjectIdDelete(body);
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


## deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete

> deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete(projectId, taskId)

Delete Task Endpoint

Delete a task from a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { DeleteTaskEndpointProjectsProjectIdTasksTaskIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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


## getProjectProjectsProjectIdGet

> ProjectRead getProjectProjectsProjectIdGet(projectId)

Get Project

Get a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { GetProjectProjectsProjectIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetProjectProjectsProjectIdGetRequest;

  try {
    const data = await api.getProjectProjectsProjectIdGet(body);
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

[**ProjectRead**](ProjectRead.md)

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


## getTaskEndpointProjectsProjectIdTasksTaskIdGet

> TaskRead getTaskEndpointProjectsProjectIdTasksTaskIdGet(projectId, taskId)

Get Task Endpoint

Get a single task from a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { GetTaskEndpointProjectsProjectIdTasksTaskIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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


## listProjectsProjectsGet

> Array&lt;ProjectRead&gt; listProjectsProjectsGet()

List Projects

List projects accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListProjectsProjectsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  try {
    const data = await api.listProjectsProjectsGet();
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

[**Array&lt;ProjectRead&gt;**](ProjectRead.md)

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


## listTasksEndpointProjectsProjectIdTasksGet

> Array&lt;TaskRead&gt; listTasksEndpointProjectsProjectIdTasksGet(projectId)

List Tasks Endpoint

List tasks for a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListTasksEndpointProjectsProjectIdTasksGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
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


## updateProjectProjectsProjectIdPatch

> ProjectRead updateProjectProjectsProjectIdPatch(projectId, projectUpdate)

Update Project

Update a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { UpdateProjectProjectsProjectIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectUpdate
    projectUpdate: ...,
  } satisfies UpdateProjectProjectsProjectIdPatchRequest;

  try {
    const data = await api.updateProjectProjectsProjectIdPatch(body);
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
| **projectUpdate** | [ProjectUpdate](ProjectUpdate.md) |  | |

### Return type

[**ProjectRead**](ProjectRead.md)

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
  ProjectsApi,
} from '';
import type { UpdateTaskEndpointProjectsProjectIdTasksTaskIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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

