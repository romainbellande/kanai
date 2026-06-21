
# TaskUpdate

Request payload for updating a project task.  Parameters:     title: Optional replacement task title.     column_id: Optional replacement workflow column ID.     priority: Optional replacement priority level. Explicit null clears it.     story_points: Optional replacement Story Points estimate. Explicit null clears it.     assignee_id: Optional replacement user ID assigned to the task.     description: Optional replacement task details.     acceptance_criteria: Optional replacement completion criteria.     tag: Optional replacement task tag.

## Properties

Name | Type
------------ | -------------
`title` | string
`columnId` | string
`priority` | string
`storyPoints` | number
`assigneeId` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string
`prerequisiteTaskIds` | Array&lt;string&gt;

## Example

```typescript
import type { TaskUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "columnId": null,
  "priority": null,
  "storyPoints": null,
  "assigneeId": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
  "prerequisiteTaskIds": null,
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


