# ProjectsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addProjectMemberProjectsProjectIdMembersPost**](ProjectsApi.md#addprojectmemberprojectsprojectidmemberspost) | **POST** /projects/{project_id}/members | Add Project Member |
| [**addTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPost**](ProjectsApi.md#addtasktoactiveprojectsprintprojectsprojectidsprintsactivetaskspost) | **POST** /projects/{project_id}/sprints/active/tasks | Add Task To Active Project Sprint |
| [**closeActiveProjectSprintProjectsProjectIdSprintsActiveClosePost**](ProjectsApi.md#closeactiveprojectsprintprojectsprojectidsprintsactiveclosepost) | **POST** /projects/{project_id}/sprints/active/close | Close Active Project Sprint |
| [**createProjectBacklogTaskProjectsProjectIdBacklogTasksPost**](ProjectsApi.md#createprojectbacklogtaskprojectsprojectidbacklogtaskspost) | **POST** /projects/{project_id}/backlog/tasks | Create Project Backlog Task |
| [**createProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPost**](ProjectsApi.md#createprojectbacklogtasksbulkprojectsprojectidbacklogtasksbulkpost) | **POST** /projects/{project_id}/backlog/tasks/bulk | Create Project Backlog Tasks Bulk |
| [**createProjectColumnProjectsProjectIdColumnsPost**](ProjectsApi.md#createprojectcolumnprojectsprojectidcolumnspost) | **POST** /projects/{project_id}/columns | Create Project Column |
| [**createProjectEndpointProjectsPost**](ProjectsApi.md#createprojectendpointprojectspost) | **POST** /projects | Create Project Endpoint |
| [**createProjectSprintProjectsProjectIdSprintsPost**](ProjectsApi.md#createprojectsprintprojectsprojectidsprintspost) | **POST** /projects/{project_id}/sprints | Create Project Sprint |
| [**createTaskEndpointProjectsProjectIdTasksPost**](ProjectsApi.md#createtaskendpointprojectsprojectidtaskspost) | **POST** /projects/{project_id}/tasks | Create Task Endpoint |
| [**deleteProjectColumnProjectsProjectIdColumnsColumnIdDelete**](ProjectsApi.md#deleteprojectcolumnprojectsprojectidcolumnscolumniddelete) | **DELETE** /projects/{project_id}/columns/{column_id} | Delete Project Column |
| [**deleteProjectProjectsProjectIdDelete**](ProjectsApi.md#deleteprojectprojectsprojectiddelete) | **DELETE** /projects/{project_id} | Delete Project |
| [**deleteTaskEndpointProjectsProjectIdTasksTaskIdDelete**](ProjectsApi.md#deletetaskendpointprojectsprojectidtaskstaskiddelete) | **DELETE** /projects/{project_id}/tasks/{task_id} | Delete Task Endpoint |
| [**getActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGet**](ProjectsApi.md#getactiveprojectsprintcloseconfirmationprojectsprojectidsprintsactivecloseconfirmationget) | **GET** /projects/{project_id}/sprints/active/close-confirmation | Get Active Project Sprint Close Confirmation |
| [**getActiveProjectSprintProjectsProjectIdSprintsActiveGet**](ProjectsApi.md#getactiveprojectsprintprojectsprojectidsprintsactiveget) | **GET** /projects/{project_id}/sprints/active | Get Active Project Sprint |
| [**getProjectDoneColumnProjectsProjectIdDoneColumnGet**](ProjectsApi.md#getprojectdonecolumnprojectsprojectiddonecolumnget) | **GET** /projects/{project_id}/done-column | Get Project Done Column |
| [**getProjectProjectsProjectIdGet**](ProjectsApi.md#getprojectprojectsprojectidget) | **GET** /projects/{project_id} | Get Project |
| [**getTaskEndpointProjectsProjectIdTasksTaskIdGet**](ProjectsApi.md#gettaskendpointprojectsprojectidtaskstaskidget) | **GET** /projects/{project_id}/tasks/{task_id} | Get Task Endpoint |
| [**listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet**](ProjectsApi.md#listactivesprinttasksendpointprojectsprojectidtasksactivesprintget) | **GET** /projects/{project_id}/tasks/active-sprint | List Active Sprint Tasks Endpoint |
| [**listProjectBacklogProjectsProjectIdBacklogGet**](ProjectsApi.md#listprojectbacklogprojectsprojectidbacklogget) | **GET** /projects/{project_id}/backlog | List Project Backlog |
| [**listProjectChatMessagesProjectsProjectIdChatMessagesGet**](ProjectsApi.md#listprojectchatmessagesprojectsprojectidchatmessagesget) | **GET** /projects/{project_id}/chat/messages | List Project Chat Messages |
| [**listProjectColumnsProjectsProjectIdColumnsGet**](ProjectsApi.md#listprojectcolumnsprojectsprojectidcolumnsget) | **GET** /projects/{project_id}/columns | List Project Columns |
| [**listProjectSprintHistoryProjectsProjectIdSprintsHistoryGet**](ProjectsApi.md#listprojectsprinthistoryprojectsprojectidsprintshistoryget) | **GET** /projects/{project_id}/sprints/history | List Project Sprint History |
| [**listProjectsProjectsGet**](ProjectsApi.md#listprojectsprojectsget) | **GET** /projects | List Projects |
| [**listTasksEndpointProjectsProjectIdTasksGet**](ProjectsApi.md#listtasksendpointprojectsprojectidtasksget) | **GET** /projects/{project_id}/tasks | List Tasks Endpoint |
| [**moveTaskEndpointProjectsProjectIdTasksTaskIdMovePut**](ProjectsApi.md#movetaskendpointprojectsprojectidtaskstaskidmoveput) | **PUT** /projects/{project_id}/tasks/{task_id}/move | Move Task Endpoint |
| [**removeTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDelete**](ProjectsApi.md#removetaskfromactiveprojectsprintprojectsprojectidsprintsactivetaskstaskiddelete) | **DELETE** /projects/{project_id}/sprints/active/tasks/{task_id} | Remove Task From Active Project Sprint |
| [**reorderProjectBacklogProjectsProjectIdBacklogReorderPut**](ProjectsApi.md#reorderprojectbacklogprojectsprojectidbacklogreorderput) | **PUT** /projects/{project_id}/backlog/reorder | Reorder Project Backlog |
| [**reorderProjectColumnsProjectsProjectIdColumnsReorderPut**](ProjectsApi.md#reorderprojectcolumnsprojectsprojectidcolumnsreorderput) | **PUT** /projects/{project_id}/columns/reorder | Reorder Project Columns |
| [**updateActiveProjectSprintProjectsProjectIdSprintsActivePatch**](ProjectsApi.md#updateactiveprojectsprintprojectsprojectidsprintsactivepatch) | **PATCH** /projects/{project_id}/sprints/active | Update Active Project Sprint |
| [**updateProjectColumnProjectsProjectIdColumnsColumnIdPatch**](ProjectsApi.md#updateprojectcolumnprojectsprojectidcolumnscolumnidpatch) | **PATCH** /projects/{project_id}/columns/{column_id} | Update Project Column |
| [**updateProjectDoneColumnProjectsProjectIdDoneColumnPatch**](ProjectsApi.md#updateprojectdonecolumnprojectsprojectiddonecolumnpatch) | **PATCH** /projects/{project_id}/done-column | Update Project Done Column |
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


## addTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPost

> TaskRead addTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPost(projectId, projectSprintTaskAdd)

Add Task To Active Project Sprint

Add an existing Backlog task to the active sprint.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { AddTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectSprintTaskAdd
    projectSprintTaskAdd: ...,
  } satisfies AddTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPostRequest;

  try {
    const data = await api.addTaskToActiveProjectSprintProjectsProjectIdSprintsActiveTasksPost(body);
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
| **projectSprintTaskAdd** | [ProjectSprintTaskAdd](ProjectSprintTaskAdd.md) |  | |

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


## closeActiveProjectSprintProjectsProjectIdSprintsActiveClosePost

> ProjectSprintCloseRead closeActiveProjectSprintProjectsProjectIdSprintsActiveClosePost(projectId)

Close Active Project Sprint

Close the active sprint and create immutable task history.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CloseActiveProjectSprintProjectsProjectIdSprintsActiveClosePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies CloseActiveProjectSprintProjectsProjectIdSprintsActiveClosePostRequest;

  try {
    const data = await api.closeActiveProjectSprintProjectsProjectIdSprintsActiveClosePost(body);
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

[**ProjectSprintCloseRead**](ProjectSprintCloseRead.md)

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


## createProjectBacklogTaskProjectsProjectIdBacklogTasksPost

> TaskRead createProjectBacklogTaskProjectsProjectIdBacklogTasksPost(projectId, taskCreate)

Create Project Backlog Task

Create a task at the top of the project Backlog.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateProjectBacklogTaskProjectsProjectIdBacklogTasksPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // TaskCreate
    taskCreate: ...,
  } satisfies CreateProjectBacklogTaskProjectsProjectIdBacklogTasksPostRequest;

  try {
    const data = await api.createProjectBacklogTaskProjectsProjectIdBacklogTasksPost(body);
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


## createProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPost

> Array&lt;TaskRead&gt; createProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPost(projectId, backlogTaskBulkCreate)

Create Project Backlog Tasks Bulk

Atomically save reviewed draft tasks into the project Backlog.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // BacklogTaskBulkCreate
    backlogTaskBulkCreate: ...,
  } satisfies CreateProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPostRequest;

  try {
    const data = await api.createProjectBacklogTasksBulkProjectsProjectIdBacklogTasksBulkPost(body);
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
| **backlogTaskBulkCreate** | [BacklogTaskBulkCreate](BacklogTaskBulkCreate.md) |  | |

### Return type

[**Array&lt;TaskRead&gt;**](TaskRead.md)

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


## createProjectColumnProjectsProjectIdColumnsPost

> ProjectColumnRead createProjectColumnProjectsProjectIdColumnsPost(projectId, projectColumnCreate)

Create Project Column

Create a workflow column for a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateProjectColumnProjectsProjectIdColumnsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectColumnCreate
    projectColumnCreate: ...,
  } satisfies CreateProjectColumnProjectsProjectIdColumnsPostRequest;

  try {
    const data = await api.createProjectColumnProjectsProjectIdColumnsPost(body);
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
| **projectColumnCreate** | [ProjectColumnCreate](ProjectColumnCreate.md) |  | |

### Return type

[**ProjectColumnRead**](ProjectColumnRead.md)

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


## createProjectSprintProjectsProjectIdSprintsPost

> ProjectSprintRead createProjectSprintProjectsProjectIdSprintsPost(projectId, projectSprintCreate)

Create Project Sprint

Create an empty active sprint for a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { CreateProjectSprintProjectsProjectIdSprintsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectSprintCreate
    projectSprintCreate: ...,
  } satisfies CreateProjectSprintProjectsProjectIdSprintsPostRequest;

  try {
    const data = await api.createProjectSprintProjectsProjectIdSprintsPost(body);
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
| **projectSprintCreate** | [ProjectSprintCreate](ProjectSprintCreate.md) |  | |

### Return type

[**ProjectSprintRead**](ProjectSprintRead.md)

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


## deleteProjectColumnProjectsProjectIdColumnsColumnIdDelete

> deleteProjectColumnProjectsProjectIdColumnsColumnIdDelete(projectId, columnId)

Delete Project Column

Delete an empty workflow column from a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { DeleteProjectColumnProjectsProjectIdColumnsColumnIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    columnId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteProjectColumnProjectsProjectIdColumnsColumnIdDeleteRequest;

  try {
    const data = await api.deleteProjectColumnProjectsProjectIdColumnsColumnIdDelete(body);
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
| **columnId** | `string` |  | [Defaults to `undefined`] |

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


## getActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGet

> ProjectSprintClosePreviewRead getActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGet(projectId)

Get Active Project Sprint Close Confirmation

Preview the irreversible active sprint close outcome.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { GetActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGetRequest;

  try {
    const data = await api.getActiveProjectSprintCloseConfirmationProjectsProjectIdSprintsActiveCloseConfirmationGet(body);
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

[**ProjectSprintClosePreviewRead**](ProjectSprintClosePreviewRead.md)

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


## getActiveProjectSprintProjectsProjectIdSprintsActiveGet

> ProjectSprintRead getActiveProjectSprintProjectsProjectIdSprintsActiveGet(projectId)

Get Active Project Sprint

Get the active sprint for a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { GetActiveProjectSprintProjectsProjectIdSprintsActiveGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetActiveProjectSprintProjectsProjectIdSprintsActiveGetRequest;

  try {
    const data = await api.getActiveProjectSprintProjectsProjectIdSprintsActiveGet(body);
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

[**ProjectSprintRead**](ProjectSprintRead.md)

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


## getProjectDoneColumnProjectsProjectIdDoneColumnGet

> ProjectDoneColumnRead getProjectDoneColumnProjectsProjectIdDoneColumnGet(projectId)

Get Project Done Column

Get the Done Column designation for a project visible to the user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { GetProjectDoneColumnProjectsProjectIdDoneColumnGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetProjectDoneColumnProjectsProjectIdDoneColumnGetRequest;

  try {
    const data = await api.getProjectDoneColumnProjectsProjectIdDoneColumnGet(body);
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

[**ProjectDoneColumnRead**](ProjectDoneColumnRead.md)

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


## listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet

> Array&lt;TaskRead&gt; listActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGet(projectId)

List Active Sprint Tasks Endpoint

List tasks selected into the project\&#39;s active sprint.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListActiveSprintTasksEndpointProjectsProjectIdTasksActiveSprintGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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


## listProjectBacklogProjectsProjectIdBacklogGet

> Array&lt;TaskRead&gt; listProjectBacklogProjectsProjectIdBacklogGet(projectId)

List Project Backlog

List unfinished non-sprint tasks in project Backlog order.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListProjectBacklogProjectsProjectIdBacklogGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListProjectBacklogProjectsProjectIdBacklogGetRequest;

  try {
    const data = await api.listProjectBacklogProjectsProjectIdBacklogGet(body);
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


## listProjectChatMessagesProjectsProjectIdChatMessagesGet

> Array&lt;ProjectChatMessageRead&gt; listProjectChatMessagesProjectsProjectIdChatMessagesGet(projectId, cursor)

List Project Chat Messages

List chat history for a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListProjectChatMessagesProjectsProjectIdChatMessagesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string (optional)
    cursor: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListProjectChatMessagesProjectsProjectIdChatMessagesGetRequest;

  try {
    const data = await api.listProjectChatMessagesProjectsProjectIdChatMessagesGet(body);
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
| **cursor** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;ProjectChatMessageRead&gt;**](ProjectChatMessageRead.md)

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


## listProjectColumnsProjectsProjectIdColumnsGet

> Array&lt;ProjectColumnRead&gt; listProjectColumnsProjectsProjectIdColumnsGet(projectId)

List Project Columns

List workflow columns for a project accessible to the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListProjectColumnsProjectsProjectIdColumnsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListProjectColumnsProjectsProjectIdColumnsGetRequest;

  try {
    const data = await api.listProjectColumnsProjectsProjectIdColumnsGet(body);
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

[**Array&lt;ProjectColumnRead&gt;**](ProjectColumnRead.md)

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


## listProjectSprintHistoryProjectsProjectIdSprintsHistoryGet

> Array&lt;ProjectSprintHistoryRead&gt; listProjectSprintHistoryProjectsProjectIdSprintsHistoryGet(projectId)

List Project Sprint History

List closed sprint history for a project participant.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ListProjectSprintHistoryProjectsProjectIdSprintsHistoryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListProjectSprintHistoryProjectsProjectIdSprintsHistoryGetRequest;

  try {
    const data = await api.listProjectSprintHistoryProjectsProjectIdSprintsHistoryGet(body);
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

[**Array&lt;ProjectSprintHistoryRead&gt;**](ProjectSprintHistoryRead.md)

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

> Array&lt;TaskRead&gt; listTasksEndpointProjectsProjectIdTasksGet(projectId, title, limit, excludeTaskId)

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
  ProjectsApi,
} from '';
import type { MoveTaskEndpointProjectsProjectIdTasksTaskIdMovePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

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


## removeTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDelete

> TaskRead removeTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDelete(projectId, taskId)

Remove Task From Active Project Sprint

Remove an active sprint task back to the project Backlog.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { RemoveTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    taskId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies RemoveTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDeleteRequest;

  try {
    const data = await api.removeTaskFromActiveProjectSprintProjectsProjectIdSprintsActiveTasksTaskIdDelete(body);
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


## reorderProjectBacklogProjectsProjectIdBacklogReorderPut

> Array&lt;TaskRead&gt; reorderProjectBacklogProjectsProjectIdBacklogReorderPut(projectId, projectBacklogReorder)

Reorder Project Backlog

Persist a complete manual Backlog task order.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ReorderProjectBacklogProjectsProjectIdBacklogReorderPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectBacklogReorder
    projectBacklogReorder: ...,
  } satisfies ReorderProjectBacklogProjectsProjectIdBacklogReorderPutRequest;

  try {
    const data = await api.reorderProjectBacklogProjectsProjectIdBacklogReorderPut(body);
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
| **projectBacklogReorder** | [ProjectBacklogReorder](ProjectBacklogReorder.md) |  | |

### Return type

[**Array&lt;TaskRead&gt;**](TaskRead.md)

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


## reorderProjectColumnsProjectsProjectIdColumnsReorderPut

> Array&lt;ProjectColumnRead&gt; reorderProjectColumnsProjectsProjectIdColumnsReorderPut(projectId, projectColumnReorder)

Reorder Project Columns

Reorder all workflow columns for a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { ReorderProjectColumnsProjectsProjectIdColumnsReorderPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectColumnReorder
    projectColumnReorder: ...,
  } satisfies ReorderProjectColumnsProjectsProjectIdColumnsReorderPutRequest;

  try {
    const data = await api.reorderProjectColumnsProjectsProjectIdColumnsReorderPut(body);
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
| **projectColumnReorder** | [ProjectColumnReorder](ProjectColumnReorder.md) |  | |

### Return type

[**Array&lt;ProjectColumnRead&gt;**](ProjectColumnRead.md)

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


## updateActiveProjectSprintProjectsProjectIdSprintsActivePatch

> ProjectSprintRead updateActiveProjectSprintProjectsProjectIdSprintsActivePatch(projectId, projectSprintUpdate)

Update Active Project Sprint

Update active sprint metadata for a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { UpdateActiveProjectSprintProjectsProjectIdSprintsActivePatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectSprintUpdate
    projectSprintUpdate: ...,
  } satisfies UpdateActiveProjectSprintProjectsProjectIdSprintsActivePatchRequest;

  try {
    const data = await api.updateActiveProjectSprintProjectsProjectIdSprintsActivePatch(body);
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
| **projectSprintUpdate** | [ProjectSprintUpdate](ProjectSprintUpdate.md) |  | |

### Return type

[**ProjectSprintRead**](ProjectSprintRead.md)

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


## updateProjectColumnProjectsProjectIdColumnsColumnIdPatch

> ProjectColumnRead updateProjectColumnProjectsProjectIdColumnsColumnIdPatch(projectId, columnId, projectColumnUpdate)

Update Project Column

Rename a workflow column for a project owned by the current user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { UpdateProjectColumnProjectsProjectIdColumnsColumnIdPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    columnId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectColumnUpdate
    projectColumnUpdate: ...,
  } satisfies UpdateProjectColumnProjectsProjectIdColumnsColumnIdPatchRequest;

  try {
    const data = await api.updateProjectColumnProjectsProjectIdColumnsColumnIdPatch(body);
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
| **columnId** | `string` |  | [Defaults to `undefined`] |
| **projectColumnUpdate** | [ProjectColumnUpdate](ProjectColumnUpdate.md) |  | |

### Return type

[**ProjectColumnRead**](ProjectColumnRead.md)

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


## updateProjectDoneColumnProjectsProjectIdDoneColumnPatch

> ProjectDoneColumnRead updateProjectDoneColumnProjectsProjectIdDoneColumnPatch(projectId, projectDoneColumnUpdate)

Update Project Done Column

Change the Done Column designation for a project owned by the user.

### Example

```ts
import {
  Configuration,
  ProjectsApi,
} from '';
import type { UpdateProjectDoneColumnProjectsProjectIdDoneColumnPatchRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ProjectsApi();

  const body = {
    // string
    projectId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // ProjectDoneColumnUpdate
    projectDoneColumnUpdate: ...,
  } satisfies UpdateProjectDoneColumnProjectsProjectIdDoneColumnPatchRequest;

  try {
    const data = await api.updateProjectDoneColumnProjectsProjectIdDoneColumnPatch(body);
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
| **projectDoneColumnUpdate** | [ProjectDoneColumnUpdate](ProjectDoneColumnUpdate.md) |  | |

### Return type

[**ProjectDoneColumnRead**](ProjectDoneColumnRead.md)

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

