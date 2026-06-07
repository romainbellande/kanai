
# TaskCreate

Request payload for creating a project task.  Parameters:     title: Task title.     column_id: Optional workflow column ID. Defaults to the first project column.     priority: Optional priority level for the task.     assignee_id: Optional user ID assigned to the task.     description: Optional task details.     acceptance_criteria: Optional criteria required to complete the task.     tag: Optional task tag.

## Properties

Name | Type
------------ | -------------
`title` | string
`columnId` | string
`priority` | string
`assigneeId` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string

## Example

```typescript
import type { TaskCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "columnId": null,
  "priority": null,
  "assigneeId": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
} satisfies TaskCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TaskCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


