import {sqliteTable,text,integer,check} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const records=sqliteTable('records',{key:text('key').primaryKey(),data:text('data').notNull()});
export const versions=sqliteTable('versions',{id:integer('id').primaryKey(),revision:integer('revision').notNull()});
export const guards=sqliteTable('guards',{id:text('id').primaryKey(),valid:integer('valid').notNull()},t=>[check('valid_revision',sql`${t.valid}=1`)]);
export const events=sqliteTable('events',{id:text('id').primaryKey(),at:text('at').notNull(),projectId:text('project_id'),taskId:text('task_id'),actor:text('actor').notNull(),summary:text('summary').notNull(),data:text('data').notNull()});
