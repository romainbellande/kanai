
# UserRead

Response payload for a user.

## Properties

Name | Type
------------ | -------------
`id` | string
`externalId` | string
`firstName` | string
`lastName` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { UserRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "externalId": null,
  "firstName": null,
  "lastName": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies UserRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


