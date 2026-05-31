
# ProjectRead

Defines the project response payload.  Attributes:     id: Project identifier.     name: Project display name.     code: Three-character project code.     priority: Project priority label.     description: Optional project description.     status: Optional project status label.     owner_ids: User IDs assigned as project owners.     member_ids: User IDs assigned as project members.     created_at: Optional timestamp when the project was created.     updated_at: Optional timestamp when the project was last updated.

## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`code` | string
`priority` | string
`description` | string
`status` | string
`ownerIds` | Array&lt;string&gt;
`memberIds` | Array&lt;string&gt;
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { ProjectRead } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "code": null,
  "priority": null,
  "description": null,
  "status": null,
  "ownerIds": null,
  "memberIds": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies ProjectRead

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProjectRead
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


