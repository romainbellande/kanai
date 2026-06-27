
# ProjectDashboardRead

Aggregated Project Dashboard payload.

## Properties

Name | Type
------------ | -------------
`projectId` | string
`generatedAt` | Date
`charts` | [Array&lt;ProjectDashboardCardRead&gt;](ProjectDashboardCardRead.md)

## Example

```typescript
import type { ProjectDashboardRead } from ''

// TODO: Update the object below with actual values
const example = {
  "projectId": null,
  "generatedAt": null,
  "charts": null,
} satisfies ProjectDashboardRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectDashboardRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


