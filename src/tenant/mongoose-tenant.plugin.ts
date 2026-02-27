import { Schema } from 'mongoose';
import { tenantContext } from './tenant.context';

export function tenantPlugin(schema: Schema) {
    schema.add({ workspaceId: { type: String, required: true, index: true } });

    const addWorkspaceIdToQuery = function (this: any) {
        const context = tenantContext.getStore();
        if (context && context.workspaceId) {
            this.where({ workspaceId: context.workspaceId });
        }
    };

    const addWorkspaceIdToDoc = function (this: any, next: (err?: import("mongoose").CallbackError) => void) {
        const context = tenantContext.getStore();
        if (context && context.workspaceId) {
            this.workspaceId = context.workspaceId;
        }
        next();
    };

    // Find hooks
    schema.pre('find', addWorkspaceIdToQuery);
    schema.pre('findOne', addWorkspaceIdToQuery);
    schema.pre('findOneAndUpdate', addWorkspaceIdToQuery);
    schema.pre('findOneAndDelete', addWorkspaceIdToQuery);
    schema.pre('findOneAndReplace', addWorkspaceIdToQuery);
    schema.pre('updateOne', addWorkspaceIdToQuery);
    schema.pre('updateMany', addWorkspaceIdToQuery);
    schema.pre('deleteMany', addWorkspaceIdToQuery);
    schema.pre('deleteOne', addWorkspaceIdToQuery);
    schema.pre('countDocuments', addWorkspaceIdToQuery);
    // @ts-ignore
    schema.pre('count', addWorkspaceIdToQuery); // deprecated but sometimes used

    // Document Save hook
    schema.pre('save', addWorkspaceIdToDoc);

    // Aggregate hook to inject $match for workspaceId at the start of the pipeline
    schema.pre('aggregate', function () {
        const context = tenantContext.getStore();
        if (context && context.workspaceId) {
            this.pipeline().unshift({ $match: { workspaceId: context.workspaceId } });
        }
    });
}
