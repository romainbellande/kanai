import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "#/domains/workspace/ui/BoardPage";

export const Route = createFileRoute("/")({ component: BoardPage });
