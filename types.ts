export interface ClickUpList {
  id: string;
  name: string;
  content?: string;
}

export interface ClickUpStatus {
  status: string;
  color: string;
  type: string;
}

export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string | null;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: ClickUpStatus;
  assignees: ClickUpUser[];
  due_date: string | null;
  start_date?: string | null;
  date_created: string;
  date_updated?: string;
  url: string;
  parent?: string | null;
  listId?: string;
  listName?: string;
  description?: string;
  text_content?: string;
}

export interface ClickUpListResponse {
  lists: ClickUpList[];
}

export interface ClickUpTaskResponse {
  tasks: ClickUpTask[];
}

export interface SupabaseClientRecord {
  id: string;
  client_id: string;
  name: string;
  email: string;
  access_code: string;
  clickup_list_id: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}


export interface Metrics {
  total: number;
  completed: number;
  inProgress: number;
  byStatus: { name: string; value: number; fill: string }[];
}