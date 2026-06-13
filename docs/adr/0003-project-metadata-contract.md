# Project metadata contract

We decided to remove Project Priority as a Project concept, keep Task Priority as task-level planning metadata, and make Project Status a fixed non-null label with the values active, paused, blocked, and done. We chose this because priority belongs to individual Tasks, while Project Status should describe the Project lifecycle consistently without accepting arbitrary labels.
