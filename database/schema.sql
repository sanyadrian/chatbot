-- Central Chat Dashboard Database Schema
-- PostgreSQL Database for AWS Lightsail

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Websites that use the chat plugin
CREATE TABLE websites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Agents who handle chats
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'offline',
    max_concurrent_chats INTEGER DEFAULT 5,
    current_chats INTEGER DEFAULT 0,
    last_active TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat sessions from all websites
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(255),
    customer_ip VARCHAR(45),
    status VARCHAR(50) DEFAULT 'waiting',
    topic VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal',
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Messages in all chat sessions
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    sender_type VARCHAR(50) NOT NULL, -- 'customer', 'agent', 'system'
    sender_id INTEGER, -- agent_id if from agent
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'system'
    metadata JSONB, -- for file attachments, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent availability and status
CREATE TABLE agent_sessions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_ping TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat assignments and handoffs
CREATE TABLE chat_assignments (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    unassigned_at TIMESTAMP,
    assignment_type VARCHAR(50) DEFAULT 'manual' -- 'manual', 'auto', 'transfer'
);

-- Website API usage tracking
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    response_time INTEGER, -- in milliseconds
    status_code INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_chat_sessions_website_id ON chat_sessions(website_id);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX idx_chat_sessions_started_at ON chat_sessions(started_at);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX idx_api_usage_website_id ON api_usage(website_id);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update agent current_chats count
CREATE OR REPLACE FUNCTION update_agent_chat_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.agent_id IS NOT NULL THEN
        UPDATE agents SET current_chats = current_chats + 1 WHERE id = NEW.agent_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.agent_id IS NOT NULL AND NEW.agent_id IS NULL THEN
            UPDATE agents SET current_chats = current_chats - 1 WHERE id = OLD.agent_id;
        ELSIF OLD.agent_id IS NULL AND NEW.agent_id IS NOT NULL THEN
            UPDATE agents SET current_chats = current_chats + 1 WHERE id = NEW.agent_id;
        ELSIF OLD.agent_id IS NOT NULL AND NEW.agent_id IS NOT NULL AND OLD.agent_id != NEW.agent_id THEN
            UPDATE agents SET current_chats = current_chats - 1 WHERE id = OLD.agent_id;
            UPDATE agents SET current_chats = current_chats + 1 WHERE id = NEW.agent_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.agent_id IS NOT NULL THEN
        UPDATE agents SET current_chats = current_chats - 1 WHERE id = OLD.agent_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_chat_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_agent_chat_count();

-- Insert default admin agent
INSERT INTO agents (name, email, password_hash, status) VALUES 
('Admin Agent', 'admin@yourcompany.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'offline');

-- Insert sample website (replace with your actual website)
INSERT INTO websites (name, domain, api_key) VALUES 
('Sample Website', 'example.com', 'sample-api-key-12345');
