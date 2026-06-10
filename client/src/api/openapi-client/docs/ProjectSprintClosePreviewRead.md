
# ProjectSprintClosePreviewRead

Confirmation payload for closing an active sprint.

## Properties

Name | Type
------------ | -------------
`sprint` | [ProjectSprintRead](ProjectSprintRead.md)
`finishedCount` | number
`unfinishedCount` | number
`unfinishedTasks` | [Array&lt;TaskRead&gt;](TaskRead.md)
`carryoverStatement` | string

## Example

```typescript
import type { ProjectSprintClosePreviewRead } from ''

// TODO: Update the object below with actual values
const example = {
  "sprint": null,
  "finishedCount": null,
  "unfinishedCount": null,
  "unfinishedTasks": null,
  "carryoverStatement": null,
} satisfies ProjectSprintClosePreviewRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectSprintClosePreviewRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


