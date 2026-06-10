import { Link, useNavigate } from "@tanstack/react-router";
import { CirclePlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useCreateProjectMutation } from "#/api/client";
import { WorkspaceLayout } from "#/domains/workspace/ui/templates/WorkspaceLayout";

function createProjectCode(value: string): string {
	return value
		.replace(/[^a-z0-9]/gi, "")
		.slice(0, 3)
		.toUpperCase();
}

export function CreateProjectPage() {
	const navigate = useNavigate();
	const createProjectMutation = useCreateProjectMutation();
	const [projectCode, setProjectCode] = useState("");
	const [isProjectCodeEdited, setIsProjectCodeEdited] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const formData = new FormData(event.currentTarget);
		const name = String(formData.get("projectName") ?? "").trim();
		const code = String(formData.get("projectCode") ?? "")
			.trim()
			.toUpperCase();
		const priority = String(formData.get("projectPriority") ?? "medium");
		const description = String(formData.get("projectDescription") ?? "").trim();

		if (!name) {
			setFormError("Project name is required.");
			return;
		}

		if (!/^[A-Z0-9]{3}$/.test(code)) {
			setFormError(
				"Project code must be exactly three uppercase letters or numbers.",
			);
			return;
		}

		try {
			const project = await createProjectMutation.mutateAsync({
				name,
				code,
				priority,
				description: description || undefined,
			});

			void navigate({
				to: "/projects/$projectId",
				params: { projectId: project.id },
			});
		} catch {
			setFormError("Project could not be created. Please try again.");
		}
	}

	function handleProjectNameChange(value: string) {
		if (!isProjectCodeEdited) {
			setProjectCode(createProjectCode(value));
		}
	}

	function handleProjectCodeChange(value: string) {
		setIsProjectCodeEdited(true);
		setProjectCode(createProjectCode(value));
	}

	return (
		<WorkspaceLayout
			breadcrumbItems={[{ label: "Projects", to: "/" }, { label: "New" }]}
			contentContainerClassName="mx-auto flex w-full max-w-[680px] flex-col gap-8"
			contentClassName="px-4 py-8 pb-12 sm:px-6 lg:px-8"
			pageDescription="Define the parameters for your next strategic initiative."
			pageTitle="Create New Project"
			sectionClassName="lg:min-h-screen"
		>
			<section className="rise-in rounded-[1.75rem] border border-[color:color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[0_18px_42px_rgba(25,28,30,0.04)] sm:p-10">
				<form className="flex flex-col gap-8" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<div className="sm:col-span-2">
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectName"
							>
								Project Name
							</label>
							<input
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectName"
								name="projectName"
								onChange={(event) =>
									handleProjectNameChange(event.target.value)
								}
								placeholder="e.g., Q3 Market Expansion"
								required
								type="text"
							/>
						</div>

						<div>
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectCode"
							>
								Project Code
							</label>
							<input
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] uppercase outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectCode"
								maxLength={3}
								minLength={3}
								name="projectCode"
								onChange={(event) =>
									handleProjectCodeChange(event.target.value)
								}
								pattern="[A-Z0-9]{3}"
								placeholder="Q3M"
								required
								title="Use exactly 3 uppercase letters or numbers."
								type="text"
								value={projectCode}
							/>
							<p className="mt-2 text-xs text-[var(--on-surface-variant)]">
								Auto-generated from the project name, but editable.
							</p>
						</div>

						<div>
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectPriority"
							>
								Priority
							</label>
							<select
								className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								defaultValue="medium"
								id="projectPriority"
								name="projectPriority"
							>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</div>

						<div className="sm:col-span-2">
							<label
								className="mb-2 block text-sm font-semibold text-[var(--on-surface)]"
								htmlFor="projectDescription"
							>
								Description
							</label>
							<textarea
								className="w-full resize-none rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--on-surface)] outline-none transition placeholder:text-[var(--outline)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
								id="projectDescription"
								name="projectDescription"
								placeholder="Briefly describe the goals and scope of this project..."
								rows={4}
							/>
						</div>

						<div className="sm:col-span-2 rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
							Project members are not editable until the user directory API is
							available. The API will create this project for the authenticated
							user.
						</div>
					</div>

					{formError ? (
						<p className="rounded-xl border border-[var(--outline-variant)] bg-[var(--error-container)] px-4 py-3 text-sm font-semibold text-[var(--on-error-container)]">
							{formError}
						</p>
					) : null}

					<div className="flex flex-col-reverse gap-3 border-t border-[var(--outline-variant)] pt-6 sm:flex-row sm:items-center sm:justify-end">
						<Link
							to="/"
							className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-[var(--on-surface-variant)] no-underline transition hover:border-[var(--outline-variant)] hover:bg-[var(--surface-bright)]"
						>
							Cancel
						</Link>
						<button
							disabled={createProjectMutation.isPending}
							type="submit"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--on-primary)] shadow-[0_12px_28px_rgba(0,61,155,0.18)] transition hover:bg-[var(--primary-container)]"
						>
							<CirclePlus className="h-4 w-4" />
							{createProjectMutation.isPending
								? "Creating..."
								: "Create Project"}
						</button>
					</div>
				</form>
			</section>
		</WorkspaceLayout>
	);
}
