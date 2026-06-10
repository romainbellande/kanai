
# ProjectDoneColumnRead

Response payload for project Done Column configuration.

## Properties

Name | Type
------------ | -------------
`projectId` | string
`doneColumnId` | string
`requiresDesignation` | boolean

## Example

```typescript
import type { ProjectDoneColumnRead } from ''

// TODO: Update the object below with actual values
const example = {
  "projectId": null,
  "doneColumnId": null,
  "requiresDesignation": null,
} satisfies ProjectDoneColumnRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectDoneColumnRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


