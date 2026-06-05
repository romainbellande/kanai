
# TaskDestination

Destination for moving a task on the project board.

## Properties

Name | Type
------------ | -------------
`columnId` | string
`beforeTaskId` | string
`afterTaskId` | string

## Example

```typescript
import type { TaskDestination } from ''

// TODO: Update the object below with actual values
const example = {
  "columnId": null,
  "beforeTaskId": null,
  "afterTaskId": null,
} satisfies TaskDestination

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as TaskDestination
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


