
# ProjectSprintTaskAdd

Request payload for adding an existing task to the active sprint.

## Properties

Name | Type
------------ | -------------
`taskId` | string

## Example

```typescript
import type { ProjectSprintTaskAdd } from ''

// TODO: Update the object below with actual values
const example = {
  "taskId": null,
} satisfies ProjectSprintTaskAdd

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintTaskAdd
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


