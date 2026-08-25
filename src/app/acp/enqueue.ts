import type { ConversationSessionResult } from '../../features/interactive/conversationSession.js';
import { getGitProvider, initGitProvider } from '../../infra/git/index.js';
import { safeExternalErrorMessage } from '../../shared/utils/safeExternalErrorMessage.js';
import {
  createIssueFromTaskResult as defaultCreateIssueFromTaskResult,
  saveTaskFile as defaultSaveTaskFile,
} from '../../features/tasks/add/index.js';
import {
  createIssueAndEnqueueTask,
  enqueueTask,
  formatIssueEnqueueFailure,
} from '../../infra/task/enqueueService.js';
import type { AcpTaskContext, AcpTaskOptions } from './types.js';

type WorkflowTaskInstruction = ConversationSessionResult & {
  kind: 'workflow_execution_requested';
};

export type SaveAcpTaskFile = typeof defaultSaveTaskFile;
export type CreateAcpIssueFromTaskResult = typeof defaultCreateIssueFromTaskResult;

export interface AcpEnqueueResult {
  taskName: string;
  tasksFile: string;
  workflow: string;
  issueNumber?: number;
  worktree: boolean;
  autoPr: boolean;
  draftPr: boolean;
}

function throwIfAbortRequested(abortSignal: AbortSignal | undefined): void {
  if (abortSignal?.aborted) {
    throw new Error('ACP session was cancelled');
  }
}

export async function enqueueAcpTask(input: {
  cwd: string;
  instruction: WorkflowTaskInstruction;
  workflow: string;
  saveTaskFile: SaveAcpTaskFile;
  taskContext?: AcpTaskContext;
  taskOptions?: AcpTaskOptions;
  abortSignal?: AbortSignal;
}): Promise<AcpEnqueueResult> {
  throwIfAbortRequested(input.abortSignal);
  const worktree = input.taskOptions?.worktree ?? true;
  const autoPr = input.taskOptions?.autoPr ?? false;
  const draftPr = input.taskOptions?.draftPr ?? false;
  return enqueueTask({
    cwd: input.cwd,
    task: input.instruction.task,
    workflow: input.workflow,
    worktree,
    autoPr,
    ...(input.taskOptions?.draftPr !== undefined ? { draftPr } : {}),
    taskContext: input.taskContext,
  }, input.saveTaskFile).then((result) => ({
    ...result,
    worktree,
    autoPr,
    draftPr,
  }));
}

export async function createIssueAndEnqueueAcpTask(input: {
  cwd: string;
  instruction: WorkflowTaskInstruction;
  workflow: string;
  saveTaskFile: SaveAcpTaskFile;
  createIssueFromTaskResult?: CreateAcpIssueFromTaskResult;
  taskContext?: AcpTaskContext;
  taskOptions?: AcpTaskOptions;
  abortSignal?: AbortSignal;
}): Promise<AcpEnqueueResult> {
  throwIfAbortRequested(input.abortSignal);
  const worktree = input.taskOptions?.worktree ?? true;
  const autoPr = input.taskOptions?.autoPr ?? false;
  const draftPr = input.taskOptions?.draftPr ?? false;
  initGitProvider(input.cwd);
  const gitProvider = getGitProvider();
  throwIfAbortRequested(input.abortSignal);
  const result = await createIssueAndEnqueueTask({
    cwd: input.cwd,
    task: input.instruction.task,
    workflow: input.workflow,
    worktree,
    autoPr,
    ...(input.taskOptions?.draftPr !== undefined ? { draftPr } : {}),
    taskContext: input.taskContext,
    gitProvider,
    abortSignal: input.abortSignal,
  }, {
    saveTaskFile: input.saveTaskFile,
    createIssueFromTaskResult: input.createIssueFromTaskResult ?? defaultCreateIssueFromTaskResult,
  });
  if (!result.success) {
    throw new Error(formatIssueEnqueueFailure(result.failure, safeExternalErrorMessage));
  }
  return {
    ...result.created,
    worktree,
    autoPr,
    draftPr,
  };
}

export { defaultCreateIssueFromTaskResult, defaultSaveTaskFile };
