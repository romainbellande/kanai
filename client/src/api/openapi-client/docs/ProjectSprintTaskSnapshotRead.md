
# ProjectSprintTaskSnapshotRead

Historical task snapshot captured when a sprint closes.

## Properties

Name | Type
------------ | -------------
`id` | string
`sprintId` | string
`taskId` | string
`columnId` | string
`title` | string
`outcome` | string
`priority` | string
`storyPoints` | number
`rank` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string
`liveTaskExists` | boolean
`createdAt` | Date

## Example

```typescript
import type { ProjectSprintTaskSnapshotRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "sprintId": null,
  "taskId": null,
  "columnId": null,
  "title": null,
  "outcome": null,
  "priority": null,
  "storyPoints": null,
  "rank": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
  "liveTaskExists": null,
  "createdAt": null,
} satisfies ProjectSprintTaskSnapshotRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintTaskSnapshotRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


