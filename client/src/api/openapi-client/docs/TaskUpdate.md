
# TaskUpdate

Request payload for updating a project task.  Parameters:     title: Optional replacement task title.     status: Optional replacement workflow status.     priority: Optional replacement priority level.     assignee_id: Optional replacement user ID assigned to the task.     description: Optional replacement task details.     acceptance_criteria: Optional replacement completion criteria.     tag: Optional replacement task tag.

## Properties

Name | Type
------------ | -------------
`title` | string
`status` | string
`priority` | string
`assigneeId` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string

## Example

```typescript
import type { TaskUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "status": null,
  "priority": null,
  "assigneeId": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
} satisfies TaskUpdate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TaskUpdate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


