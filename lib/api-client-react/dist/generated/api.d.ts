import type { DataTag, DefinedInitialDataOptions, DefinedUseQueryResult, QueryClient, QueryKey, UndefinedInitialDataOptions, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AppendConversationMessageBody, ConversationMessage, ConversationMessages, ConversationSummary, CreateConversationBody, CreateTaskBody, ErrorResponse, HealthStatus, JarvisConfirmationRequest, JarvisConfirmationResponse, JarvisErrorResponse, JarvisRunRequest, JarvisRunResult, JarvisSession, JarvisSessionSummary, JarvisStopResponse, ListConversationsParams, ListTasksParams, RenameConversationBody, Task, TaskStats, UpdateTaskBody } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRunJarvisUrl: () => string;
/**
 * @summary Run Jarvis to completion
 */
export declare const runJarvis: (jarvisRunRequest: JarvisRunRequest, options?: Parameters<typeof customFetch>[1]) => Promise<JarvisRunResult>;
export declare const getRunJarvisMutationKey: () => readonly ["runJarvis"];
export declare const getRunJarvisMutationOptions: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runJarvis>>, TError, RunJarvisMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof runJarvis>>, TError, RunJarvisMutationVariables, TContext>;
export type RunJarvisMutationResult = NonNullable<Awaited<ReturnType<typeof runJarvis>>>;
export type RunJarvisMutationBody = BodyType<JarvisRunRequest>;
export type RunJarvisMutationError = ErrorType<JarvisErrorResponse>;
export type RunJarvisMutationVariables = {
    data: BodyType<JarvisRunRequest>;
};
/**
* @summary Run Jarvis to completion
*/
export declare const useRunJarvis: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof runJarvis>>, TError, RunJarvisMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof runJarvis>>, TError, RunJarvisMutationVariables, TContext>;
export declare const getStreamJarvisRunUrl: () => string;
/**
 * Streams Server-Sent Events: started (session ID), step (a StepResult), audit (sanitized tool call record), confirmation_required (risky action), done (status and result), or error (message and session ID).
 * @summary Run Jarvis and stream progress events
 */
export declare const streamJarvisRun: (jarvisRunRequest: JarvisRunRequest, options?: Parameters<typeof customFetch>[1]) => Promise<string>;
export declare const getStreamJarvisRunMutationKey: () => readonly ["streamJarvisRun"];
export declare const getStreamJarvisRunMutationOptions: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof streamJarvisRun>>, TError, StreamJarvisRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof streamJarvisRun>>, TError, StreamJarvisRunMutationVariables, TContext>;
export type StreamJarvisRunMutationResult = NonNullable<Awaited<ReturnType<typeof streamJarvisRun>>>;
export type StreamJarvisRunMutationBody = BodyType<JarvisRunRequest>;
export type StreamJarvisRunMutationError = ErrorType<JarvisErrorResponse>;
export type StreamJarvisRunMutationVariables = {
    data: BodyType<JarvisRunRequest>;
};
/**
* @summary Run Jarvis and stream progress events
*/
export declare const useStreamJarvisRun: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof streamJarvisRun>>, TError, StreamJarvisRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof streamJarvisRun>>, TError, StreamJarvisRunMutationVariables, TContext>;
export declare const getListJarvisSessionsUrl: () => string;
/**
 * @summary List recent Jarvis sessions
 */
export declare const listJarvisSessions: (options?: Parameters<typeof customFetch>[1]) => Promise<JarvisSessionSummary[]>;
export declare const getListJarvisSessionsQueryKey: () => readonly ["/api/jarvis/sessions"];
export declare const getListJarvisSessionsQueryOptions: <TData = Awaited<ReturnType<typeof listJarvisSessions>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListJarvisSessionsQueryResult = NonNullable<Awaited<ReturnType<typeof listJarvisSessions>>>;
export type ListJarvisSessionsQueryError = ErrorType<unknown>;
export declare function useListJarvisSessions<TData = Awaited<ReturnType<typeof listJarvisSessions>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, Awaited<ReturnType<typeof listJarvisSessions>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListJarvisSessions<TData = Awaited<ReturnType<typeof listJarvisSessions>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, Awaited<ReturnType<typeof listJarvisSessions>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListJarvisSessions<TData = Awaited<ReturnType<typeof listJarvisSessions>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listJarvisSessions>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetJarvisSessionUrl: (id: string) => string;
/**
 * @summary Get a Jarvis session
 */
export declare const getJarvisSession: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JarvisSession>;
export declare const getGetJarvisSessionQueryKey: (id: string) => readonly [`/api/jarvis/sessions/${string}`];
export declare const getGetJarvisSessionQueryOptions: <TData = Awaited<ReturnType<typeof getJarvisSession>>, TError = ErrorType<JarvisErrorResponse>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetJarvisSessionQueryResult = NonNullable<Awaited<ReturnType<typeof getJarvisSession>>>;
export type GetJarvisSessionQueryError = ErrorType<JarvisErrorResponse>;
export declare function useGetJarvisSession<TData = Awaited<ReturnType<typeof getJarvisSession>>, TError = ErrorType<JarvisErrorResponse>>(id: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, Awaited<ReturnType<typeof getJarvisSession>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetJarvisSession<TData = Awaited<ReturnType<typeof getJarvisSession>>, TError = ErrorType<JarvisErrorResponse>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, Awaited<ReturnType<typeof getJarvisSession>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetJarvisSession<TData = Awaited<ReturnType<typeof getJarvisSession>>, TError = ErrorType<JarvisErrorResponse>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getJarvisSession>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getStopJarvisSessionUrl: (id: string) => string;
/**
 * @summary Stop a running Jarvis session
 */
export declare const stopJarvisSession: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JarvisStopResponse>;
export declare const getStopJarvisSessionMutationKey: () => readonly ["stopJarvisSession"];
export declare const getStopJarvisSessionMutationOptions: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof stopJarvisSession>>, TError, StopJarvisSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof stopJarvisSession>>, TError, StopJarvisSessionMutationVariables, TContext>;
export type StopJarvisSessionMutationResult = NonNullable<Awaited<ReturnType<typeof stopJarvisSession>>>;
export type StopJarvisSessionMutationError = ErrorType<JarvisErrorResponse>;
export type StopJarvisSessionMutationVariables = {
    id: string;
};
/**
* @summary Stop a running Jarvis session
*/
export declare const useStopJarvisSession: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof stopJarvisSession>>, TError, StopJarvisSessionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof stopJarvisSession>>, TError, StopJarvisSessionMutationVariables, TContext>;
export declare const getConfirmJarvisActionUrl: (id: string) => string;
/**
 * @summary Approve or deny a pending risky Jarvis action
 */
export declare const confirmJarvisAction: (id: string, jarvisConfirmationRequest: JarvisConfirmationRequest, options?: Parameters<typeof customFetch>[1]) => Promise<JarvisConfirmationResponse>;
export declare const getConfirmJarvisActionMutationKey: () => readonly ["confirmJarvisAction"];
export declare const getConfirmJarvisActionMutationOptions: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmJarvisAction>>, TError, ConfirmJarvisActionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof confirmJarvisAction>>, TError, ConfirmJarvisActionMutationVariables, TContext>;
export type ConfirmJarvisActionMutationResult = NonNullable<Awaited<ReturnType<typeof confirmJarvisAction>>>;
export type ConfirmJarvisActionMutationBody = BodyType<JarvisConfirmationRequest>;
export type ConfirmJarvisActionMutationError = ErrorType<JarvisErrorResponse>;
export type ConfirmJarvisActionMutationVariables = {
    id: string;
    data: BodyType<JarvisConfirmationRequest>;
};
/**
* @summary Approve or deny a pending risky Jarvis action
*/
export declare const useConfirmJarvisAction: <TError = ErrorType<JarvisErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmJarvisAction>>, TError, ConfirmJarvisActionMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof confirmJarvisAction>>, TError, ConfirmJarvisActionMutationVariables, TContext>;
export declare const getListConversationsUrl: (params?: ListConversationsParams) => string;
/**
 * @summary List the signed-in user's conversation history
 */
export declare const listConversations: (params?: ListConversationsParams, options?: Parameters<typeof customFetch>[1]) => Promise<ConversationSummary[]>;
export declare const getListConversationsQueryKey: (params?: ListConversationsParams) => readonly ["/api/conversations", ...ListConversationsParams[]];
export declare const getListConversationsQueryOptions: <TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>(params?: ListConversationsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListConversationsQueryResult = NonNullable<Awaited<ReturnType<typeof listConversations>>>;
export type ListConversationsQueryError = ErrorType<ErrorResponse>;
export declare function useListConversations<TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>(params: undefined | ListConversationsParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listConversations>>, TError, Awaited<ReturnType<typeof listConversations>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListConversations<TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>(params?: ListConversationsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listConversations>>, TError, Awaited<ReturnType<typeof listConversations>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListConversations<TData = Awaited<ReturnType<typeof listConversations>>, TError = ErrorType<ErrorResponse>>(params?: ListConversationsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversations>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateConversationUrl: () => string;
/**
 * @summary Create a conversation
 */
export declare const createConversation: (createConversationBody: CreateConversationBody, options?: Parameters<typeof customFetch>[1]) => Promise<ConversationSummary>;
export declare const getCreateConversationMutationKey: () => readonly ["createConversation"];
export declare const getCreateConversationMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError, CreateConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError, CreateConversationMutationVariables, TContext>;
export type CreateConversationMutationResult = NonNullable<Awaited<ReturnType<typeof createConversation>>>;
export type CreateConversationMutationBody = BodyType<CreateConversationBody>;
export type CreateConversationMutationError = ErrorType<ErrorResponse>;
export type CreateConversationMutationVariables = {
    data: BodyType<CreateConversationBody>;
};
/**
* @summary Create a conversation
*/
export declare const useCreateConversation: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createConversation>>, TError, CreateConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createConversation>>, TError, CreateConversationMutationVariables, TContext>;
export declare const getRenameConversationUrl: (id: number) => string;
/**
 * @summary Rename a conversation
 */
export declare const renameConversation: (id: number, renameConversationBody: RenameConversationBody, options?: Parameters<typeof customFetch>[1]) => Promise<ConversationSummary>;
export declare const getRenameConversationMutationKey: () => readonly ["renameConversation"];
export declare const getRenameConversationMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renameConversation>>, TError, RenameConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof renameConversation>>, TError, RenameConversationMutationVariables, TContext>;
export type RenameConversationMutationResult = NonNullable<Awaited<ReturnType<typeof renameConversation>>>;
export type RenameConversationMutationBody = BodyType<RenameConversationBody>;
export type RenameConversationMutationError = ErrorType<ErrorResponse>;
export type RenameConversationMutationVariables = {
    id: number;
    data: BodyType<RenameConversationBody>;
};
/**
* @summary Rename a conversation
*/
export declare const useRenameConversation: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renameConversation>>, TError, RenameConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof renameConversation>>, TError, RenameConversationMutationVariables, TContext>;
export declare const getDeleteConversationUrl: (id: number) => string;
/**
 * @summary Delete a conversation and its messages
 */
export declare const deleteConversation: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteConversationMutationKey: () => readonly ["deleteConversation"];
export declare const getDeleteConversationMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteConversation>>, TError, DeleteConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteConversation>>, TError, DeleteConversationMutationVariables, TContext>;
export type DeleteConversationMutationResult = NonNullable<Awaited<ReturnType<typeof deleteConversation>>>;
export type DeleteConversationMutationError = ErrorType<ErrorResponse>;
export type DeleteConversationMutationVariables = {
    id: number;
};
/**
* @summary Delete a conversation and its messages
*/
export declare const useDeleteConversation: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteConversation>>, TError, DeleteConversationMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof deleteConversation>>, TError, DeleteConversationMutationVariables, TContext>;
export declare const getListConversationMessagesUrl: (id: number) => string;
/**
 * @summary List messages in a conversation
 */
export declare const listConversationMessages: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<ConversationMessages>;
export declare const getListConversationMessagesQueryKey: (id: number) => readonly [`/api/conversations/${number}/messages`];
export declare const getListConversationMessagesQueryOptions: <TData = Awaited<ReturnType<typeof listConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListConversationMessagesQueryResult = NonNullable<Awaited<ReturnType<typeof listConversationMessages>>>;
export type ListConversationMessagesQueryError = ErrorType<ErrorResponse>;
export declare function useListConversationMessages<TData = Awaited<ReturnType<typeof listConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, Awaited<ReturnType<typeof listConversationMessages>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListConversationMessages<TData = Awaited<ReturnType<typeof listConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, Awaited<ReturnType<typeof listConversationMessages>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListConversationMessages<TData = Awaited<ReturnType<typeof listConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listConversationMessages>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getAppendConversationMessageUrl: (id: number) => string;
/**
 * @summary Append a message to a conversation
 */
export declare const appendConversationMessage: (id: number, appendConversationMessageBody: AppendConversationMessageBody, options?: Parameters<typeof customFetch>[1]) => Promise<ConversationMessage>;
export declare const getAppendConversationMessageMutationKey: () => readonly ["appendConversationMessage"];
export declare const getAppendConversationMessageMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof appendConversationMessage>>, TError, AppendConversationMessageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof appendConversationMessage>>, TError, AppendConversationMessageMutationVariables, TContext>;
export type AppendConversationMessageMutationResult = NonNullable<Awaited<ReturnType<typeof appendConversationMessage>>>;
export type AppendConversationMessageMutationBody = BodyType<AppendConversationMessageBody>;
export type AppendConversationMessageMutationError = ErrorType<ErrorResponse>;
export type AppendConversationMessageMutationVariables = {
    id: number;
    data: BodyType<AppendConversationMessageBody>;
};
/**
* @summary Append a message to a conversation
*/
export declare const useAppendConversationMessage: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof appendConversationMessage>>, TError, AppendConversationMessageMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof appendConversationMessage>>, TError, AppendConversationMessageMutationVariables, TContext>;
export declare const getListTasksUrl: (params?: ListTasksParams) => string;
/**
 * Returns all tasks for the authenticated user
 * @summary List all tasks
 */
export declare const listTasks: (params?: ListTasksParams, options?: Parameters<typeof customFetch>[1]) => Promise<Task[]>;
export declare const getListTasksQueryKey: (params?: ListTasksParams) => readonly ["/api/tasks", ...ListTasksParams[]];
export declare const getListTasksQueryOptions: <TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<ErrorResponse>>(params?: ListTasksParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListTasksQueryResult = NonNullable<Awaited<ReturnType<typeof listTasks>>>;
export type ListTasksQueryError = ErrorType<ErrorResponse>;
export declare function useListTasks<TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<ErrorResponse>>(params: undefined | ListTasksParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listTasks>>, TError, Awaited<ReturnType<typeof listTasks>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListTasks<TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<ErrorResponse>>(params?: ListTasksParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listTasks>>, TError, Awaited<ReturnType<typeof listTasks>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListTasks<TData = Awaited<ReturnType<typeof listTasks>>, TError = ErrorType<ErrorResponse>>(params?: ListTasksParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listTasks>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateTaskUrl: () => string;
/**
 * @summary Create a new task
 */
export declare const createTask: (createTaskBody: CreateTaskBody, options?: Parameters<typeof customFetch>[1]) => Promise<Task>;
export declare const getCreateTaskMutationKey: () => readonly ["createTask"];
export declare const getCreateTaskMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError, CreateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError, CreateTaskMutationVariables, TContext>;
export type CreateTaskMutationResult = NonNullable<Awaited<ReturnType<typeof createTask>>>;
export type CreateTaskMutationBody = BodyType<CreateTaskBody>;
export type CreateTaskMutationError = ErrorType<ErrorResponse>;
export type CreateTaskMutationVariables = {
    data: BodyType<CreateTaskBody>;
};
/**
* @summary Create a new task
*/
export declare const useCreateTask: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTask>>, TError, CreateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createTask>>, TError, CreateTaskMutationVariables, TContext>;
export declare const getGetTaskStatsUrl: () => string;
/**
 * Returns summary statistics for the authenticated user's tasks
 * @summary Get task statistics
 */
export declare const getTaskStats: (options?: Parameters<typeof customFetch>[1]) => Promise<TaskStats>;
export declare const getGetTaskStatsQueryKey: () => readonly ["/api/tasks/stats"];
export declare const getGetTaskStatsQueryOptions: <TData = Awaited<ReturnType<typeof getTaskStats>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetTaskStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getTaskStats>>>;
export type GetTaskStatsQueryError = ErrorType<ErrorResponse>;
export declare function useGetTaskStats<TData = Awaited<ReturnType<typeof getTaskStats>>, TError = ErrorType<ErrorResponse>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, Awaited<ReturnType<typeof getTaskStats>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetTaskStats<TData = Awaited<ReturnType<typeof getTaskStats>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, Awaited<ReturnType<typeof getTaskStats>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetTaskStats<TData = Awaited<ReturnType<typeof getTaskStats>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTaskStats>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetTaskUrl: (id: number) => string;
/**
 * @summary Get a task by ID
 */
export declare const getTask: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Task>;
export declare const getGetTaskQueryKey: (id: number) => readonly [`/api/tasks/${number}`];
export declare const getGetTaskQueryOptions: <TData = Awaited<ReturnType<typeof getTask>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTask>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTask>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetTaskQueryResult = NonNullable<Awaited<ReturnType<typeof getTask>>>;
export type GetTaskQueryError = ErrorType<ErrorResponse>;
export declare function useGetTask<TData = Awaited<ReturnType<typeof getTask>>, TError = ErrorType<ErrorResponse>>(id: number, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTask>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getTask>>, TError, Awaited<ReturnType<typeof getTask>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetTask<TData = Awaited<ReturnType<typeof getTask>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTask>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getTask>>, TError, Awaited<ReturnType<typeof getTask>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetTask<TData = Awaited<ReturnType<typeof getTask>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTask>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getUpdateTaskUrl: (id: number) => string;
/**
 * @summary Update a task
 */
export declare const updateTask: (id: number, updateTaskBody: UpdateTaskBody, options?: Parameters<typeof customFetch>[1]) => Promise<Task>;
export declare const getUpdateTaskMutationKey: () => readonly ["updateTask"];
export declare const getUpdateTaskMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
export type UpdateTaskMutationResult = NonNullable<Awaited<ReturnType<typeof updateTask>>>;
export type UpdateTaskMutationBody = BodyType<UpdateTaskBody>;
export type UpdateTaskMutationError = ErrorType<ErrorResponse>;
export type UpdateTaskMutationVariables = {
    id: number;
    data: BodyType<UpdateTaskBody>;
};
/**
* @summary Update a task
*/
export declare const useUpdateTask: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
export declare const getDeleteTaskUrl: (id: number) => string;
/**
 * @summary Delete a task
 */
export declare const deleteTask: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteTaskMutationKey: () => readonly ["deleteTask"];
export declare const getDeleteTaskMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError, DeleteTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError, DeleteTaskMutationVariables, TContext>;
export type DeleteTaskMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTask>>>;
export type DeleteTaskMutationError = ErrorType<ErrorResponse>;
export type DeleteTaskMutationVariables = {
    id: number;
};
/**
* @summary Delete a task
*/
export declare const useDeleteTask: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTask>>, TError, DeleteTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof deleteTask>>, TError, DeleteTaskMutationVariables, TContext>;
export declare const getToggleTaskCompleteUrl: (id: number) => string;
/**
 * @summary Toggle task completion
 */
export declare const toggleTaskComplete: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Task>;
export declare const getToggleTaskCompleteMutationKey: () => readonly ["toggleTaskComplete"];
export declare const getToggleTaskCompleteMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleTaskComplete>>, TError, ToggleTaskCompleteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof toggleTaskComplete>>, TError, ToggleTaskCompleteMutationVariables, TContext>;
export type ToggleTaskCompleteMutationResult = NonNullable<Awaited<ReturnType<typeof toggleTaskComplete>>>;
export type ToggleTaskCompleteMutationError = ErrorType<ErrorResponse>;
export type ToggleTaskCompleteMutationVariables = {
    id: number;
};
/**
* @summary Toggle task completion
*/
export declare const useToggleTaskComplete: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof toggleTaskComplete>>, TError, ToggleTaskCompleteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof toggleTaskComplete>>, TError, ToggleTaskCompleteMutationVariables, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map