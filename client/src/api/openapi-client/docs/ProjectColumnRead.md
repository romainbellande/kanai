
# ProjectColumnRead

Defines a project workflow column response payload.

## Properties

Name | Type
------------ | -------------
`id` | string
`projectId` | string
`name` | string
`description` | string
`position` | number
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { ProjectColumnRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "projectId": null,
  "name": null,
  "description": null,
  "position": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies ProjectColumnRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectColumnRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


