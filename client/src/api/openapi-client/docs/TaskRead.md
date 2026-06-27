
# TaskRead

Response payload for reading a project task.  Parameters:     id: Task ID.     project_id: ID of the project that owns the task.     sprint_id: Optional active or historical sprint membership ID.     title: Task title.     column_id: Workflow column ID for the task.     priority: Optional priority level for the task.     story_points: Optional Story Points estimate.     rank: Sortable LexoRank-style position within the task column.     backlog_rank: Optional manual rank within the project backlog.     assignee_id: Optional user ID assigned to the task.     description: Optional task details.     acceptance_criteria: Optional criteria required to complete the task.     tag: Optional task tag.     is_blocked: Whether the task is explicitly marked as a Blocked Project Task.     blocked_reason: Optional explanation for why the task is blocked.     created_at: Optional timestamp when the task was created.     updated_at: Optional timestamp when the task was last updated.

## Properties

Name | Type
------------ | -------------
`id` | string
`projectId` | string
`sprintId` | string
`columnId` | string
`title` | string
`priority` | string
`storyPoints` | number
`rank` | string
`backlogRank` | string
`assigneeId` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string
`isBlocked` | boolean
`blockedReason` | string
`createdAt` | Date
`updatedAt` | Date
`prerequisiteTaskIds` | Array&lt;string&gt;

## Example

```typescript
import type { TaskRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "projectId": null,
  "sprintId": null,
  "columnId": null,
  "title": null,
  "priority": null,
  "storyPoints": null,
  "rank": null,
  "backlogRank": null,
  "assigneeId": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
  "isBlocked": null,
  "blockedReason": null,
  "createdAt": null,
  "updatedAt": null,
  "prerequisiteTaskIds": null,
} satisfies TaskRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TaskRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


