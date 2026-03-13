-- Database schema for GitHub Classroom Support

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
  github_username VARCHAR(255),
  github_id VARCHAR(255) UNIQUE,
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_github_id (github_id),
  INDEX idx_google_id (google_id)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  instructor_id VARCHAR(36) NOT NULL,
  github_org_name VARCHAR(255) NOT NULL UNIQUE,
  github_org_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_semester VARCHAR(50),
  metadata_year INT,
  metadata_description TEXT,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_instructor_id (instructor_id),
  INDEX idx_github_org_name (github_org_name)
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor')),
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (user_id, course_id),
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id VARCHAR(36) PRIMARY KEY,
  course_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  repository_name VARCHAR(255) NOT NULL,
  repository_url VARCHAR(500) NOT NULL,
  template_repository_url VARCHAR(500),
  deadline TIMESTAMP,
  allow_late_submissions BOOLEAN NOT NULL DEFAULT FALSE,
  devcontainer_path VARCHAR(255) NOT NULL DEFAULT '.devcontainer/devcontainer.json',
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  config_auto_grading BOOLEAN NOT NULL DEFAULT FALSE,
  config_max_attempts INT,
  config_required_files JSON,
  config_starter_code BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_id (course_id)
);

-- Forks table
CREATE TABLE IF NOT EXISTS forks (
  id VARCHAR(36) PRIMARY KEY,
  assignment_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  github_repo_url VARCHAR(500) NOT NULL,
  github_repo_id VARCHAR(255) NOT NULL,
  forked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'submitted', 'graded')),
  env_setup_status VARCHAR(20) NOT NULL CHECK (env_setup_status IN ('pending', 'in_progress', 'completed', 'failed')),
  env_setup_last_attempt TIMESTAMP,
  env_setup_error_message TEXT,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fork (assignment_id, student_id),
  INDEX idx_assignment_id (assignment_id),
  INDEX idx_student_id (student_id)
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(36) PRIMARY KEY,
  fork_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  assignment_id VARCHAR(36) NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pull_request_url VARCHAR(500) NOT NULL,
  pull_request_number INT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'graded', 'returned')),
  grade_score DECIMAL(10, 2),
  grade_max_score DECIMAL(10, 2),
  grade_graded_by VARCHAR(36),
  grade_graded_at TIMESTAMP,
  grade_comments TEXT,
  FOREIGN KEY (fork_id) REFERENCES forks(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (grade_graded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_fork_id (fork_id),
  INDEX idx_assignment_id (assignment_id),
  INDEX idx_student_id (student_id)
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  line_number INT,
  file_path VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_submission_id (submission_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('deadline_approaching', 'late_submission', 'assignment_updated', 'graded', 'feedback_added')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_id VARCHAR(36),
  related_entity_type VARCHAR(50),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_read (read),
  INDEX idx_created_at (created_at)
);

-- Auth tokens table (stores encrypted tokens)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('github', 'google')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  scope JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_provider (user_id, provider),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
