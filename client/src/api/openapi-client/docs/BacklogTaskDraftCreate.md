
# BacklogTaskDraftCreate

Reviewed generated Backlog task draft.

## Properties

Name | Type
------------ | -------------
`key` | string
`title` | string
`priority` | string
`storyPoints` | number
`assigneeId` | string
`description` | string
`acceptanceCriteria` | string
`tag` | string
`prerequisites` | [Array&lt;TaskPrerequisiteRef&gt;](TaskPrerequisiteRef.md)

## Example

```typescript
import type { BacklogTaskDraftCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "key": null,
  "title": null,
  "priority": null,
  "storyPoints": null,
  "assigneeId": null,
  "description": null,
  "acceptanceCriteria": null,
  "tag": null,
  "prerequisites": null,
} satisfies BacklogTaskDraftCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BacklogTaskDraftCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


