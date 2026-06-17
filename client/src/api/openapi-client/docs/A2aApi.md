# A2aApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getAgentCardA2aAgentSlugWellKnownAgentCardJsonGet**](A2aApi.md#getagentcarda2aagentslugwellknownagentcardjsonget) | **GET** /a2a/{agent_slug}/.well-known/agent-card.json | Get Agent Card |
| [**invokeAgentA2aAgentSlugPost**](A2aApi.md#invokeagenta2aagentslugpost) | **POST** /a2a/{agent_slug} | Invoke Agent |



## getAgentCardA2aAgentSlugWellKnownAgentCardJsonGet

> { [key: string]: any; } getAgentCardA2aAgentSlugWellKnownAgentCardJsonGet(agentSlug)

Get Agent Card

Return the public A2A agent card for a known agent slug.

### Example

```ts
import {
  Configuration,
  A2aApi,
} from '';
import type { GetAgentCardA2aAgentSlugWellKnownAgentCardJsonGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new A2aApi();

  const body = {
    // string
    agentSlug: agentSlug_example,
  } satisfies GetAgentCardA2aAgentSlugWellKnownAgentCardJsonGetRequest;

  try {
    const data = await api.getAgentCardA2aAgentSlugWellKnownAgentCardJsonGet(body);
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
| **agentSlug** | `string` |  | [Defaults to `undefined`] |

### Return type

**{ [key: string]: any; }**

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


## invokeAgentA2aAgentSlugPost

> any invokeAgentA2aAgentSlugPost(agentSlug)

Invoke Agent

Delegate invocation to the registered A2A SDK JSON-RPC route.

### Example

```ts
import {
  Configuration,
  A2aApi,
} from '';
import type { InvokeAgentA2aAgentSlugPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new A2aApi();

  const body = {
    // string
    agentSlug: agentSlug_example,
  } satisfies InvokeAgentA2aAgentSlugPostRequest;

  try {
    const data = await api.invokeAgentA2aAgentSlugPost(body);
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
| **agentSlug** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

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

