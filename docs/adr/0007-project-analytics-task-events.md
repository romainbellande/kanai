# Project analytics uses task change events

Project Dashboard charts need delivery history that current Project Task state and Sprint History cannot reconstruct. We will record Project Task Change Events for scope, workflow-state, estimate, completion, blocked, and rework changes, then derive dashboard charts from those events instead of storing daily chart snapshots. Daily snapshots can be added later as a read optimization if event-derived charts become too slow. Event history starts at ship time; old charts stay empty rather than guessing a backfill from incomplete current-state data.
