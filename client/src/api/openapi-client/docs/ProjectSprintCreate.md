
# ProjectSprintCreate

Request payload for creating a project sprint.

## Properties

Name | Type
------------ | -------------
`plannedStartDate` | Date
`plannedEndDate` | Date
`goal` | string
`taskIds` | Array&lt;string&gt;

## Example

```typescript
import type { ProjectSprintCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "plannedStartDate": null,
  "plannedEndDate": null,
  "goal": null,
  "taskIds": null,
} satisfies ProjectSprintCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


