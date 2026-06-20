
# BacklogTaskBulkCreate

Atomic reviewed draft save request.

## Properties

Name | Type
------------ | -------------
`tasks` | [Array&lt;BacklogTaskDraftCreate&gt;](BacklogTaskDraftCreate.md)

## Example

```typescript
import type { BacklogTaskBulkCreate } from ''

// TODO: Update the object below with actual values
const example = {
  "tasks": null,
} satisfies BacklogTaskBulkCreate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BacklogTaskBulkCreate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


