// Supabase config — substitua pelos valores do seu projeto
const SUPABASE_URL = 'https://yuxtervbsiwpeiysbyhl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1eHRlcnZic2l3cGVpeXNieWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTA1OTcsImV4cCI6MjA5Mzc4NjU5N30.9EwNqdMHU5dOMKOToQRKFGuAJ9vgKLrjb9lD3MT0jSg';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
