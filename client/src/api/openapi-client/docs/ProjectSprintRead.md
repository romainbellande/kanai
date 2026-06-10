
# ProjectSprintRead

Defines a project sprint response payload.

## Properties

Name | Type
------------ | -------------
`id` | string
`projectId` | string
`name` | string
`lifecycleState` | string
`plannedStartDate` | Date
`plannedEndDate` | Date
`goal` | string
`closedAt` | Date
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { ProjectSprintRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "projectId": null,
  "name": null,
  "lifecycleState": null,
  "plannedStartDate": null,
  "plannedEndDate": null,
  "goal": null,
  "closedAt": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies ProjectSprintRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


