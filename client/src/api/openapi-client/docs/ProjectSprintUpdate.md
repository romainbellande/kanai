
# ProjectSprintUpdate

Request payload for updating active project sprint metadata.

## Properties

Name | Type
------------ | -------------
`plannedStartDate` | Date
`plannedEndDate` | Date
`goal` | string

## Example

```typescript
import type { ProjectSprintUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "plannedStartDate": null,
  "plannedEndDate": null,
  "goal": null,
} satisfies ProjectSprintUpdate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintUpdate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


