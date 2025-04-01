-- enqueue.lua
-- Enqueues a job in a specific queue
-- KEYS[1]: Queue groups set key
-- KEYS[2]: Group queue key
-- ARGV[1]: Job data in JSON format
-- ARGV[2]: Group name
-- ARGV[3]: Priority (optional, lower number = higher priority)
-- ARGV[4]: Delay in milliseconds (optional)
-- ARGV[5]: TTL in milliseconds (optional)

local queue_groups_key = KEYS[1]
local group_queue_key = KEYS[2]
local job_data = ARGV[1]
local group_name = ARGV[2]
local priority = tonumber(ARGV[3]) or 0
local delay = tonumber(ARGV[4]) or 0
local ttl = tonumber(ARGV[5]) or 0

-- Generate a unique ID for the job
local job_id = redis.call('INCR', 'qtask:job_id')

-- Create the job key
local job_key = 'qtask:job:' .. job_id

-- Store job data in a hash
redis.call('HMSET', job_key, 
  'data', job_data, 
  'status', 'queued', 
  'groupName', group_name,
  'priority', priority,
  'createdAt', redis.call('TIME')[1]
)

-- If there's a TTL, set expiration
if ttl > 0 then
  redis.call('EXPIRE', job_key, math.ceil(ttl / 1000))
end

-- If there's a delay, add to the delayed queue
if delay > 0 then
  local process_at = redis.call('TIME')[1] + math.ceil(delay / 1000)
  redis.call('ZADD', 'qtask:delayed', process_at, job_id)
else
  -- Add the job ID to the group queue by priority
  redis.call('ZADD', group_queue_key, priority, job_id)
  
  -- Add the group to the queue's group list
  redis.call('SADD', queue_groups_key, group_queue_key)
end

return job_id 