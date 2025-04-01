-- dequeue.lua
-- Dequeues a job from a specific queue
-- KEYS[1]: Group queue key
-- ARGV[1]: Maximum blocking time (optional)

local group_queue_key = KEYS[1]

-- Get the job ID with the highest priority (lowest score)
local job_id = redis.call('ZPOPMIN', group_queue_key)

-- If there are no jobs, return nil
if not job_id or #job_id == 0 then
  return nil
end

job_id = job_id[1]

-- Update the job status to "processing"
local job_key = 'qtask:job:' .. job_id
redis.call('HSET', job_key, 'status', 'processing', 'startedAt', redis.call('TIME')[1])

-- Get the job data
local job_data = redis.call('HGET', job_key, 'data') or ""
local group_name = redis.call('HGET', job_key, 'groupName') or ""

-- Return the job ID, data, and group name
return {job_id, job_data, group_name} 