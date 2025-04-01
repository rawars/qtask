-- update_status.lua
-- Updates the status of a job
-- ARGV[1]: Job ID
-- ARGV[2]: New status

local job_id = ARGV[1]
local new_status = ARGV[2]

-- Create the job key
local job_key = 'qtask:job:' .. job_id

-- Check if the job exists
if redis.call('EXISTS', job_key) == 0 then
  return false
end

-- Update the job status
redis.call('HSET', job_key, 'status', new_status)

-- If the status is "completed" or "failed", update the finish time
if new_status == 'completed' or new_status == 'failed' then
  redis.call('HSET', job_key, 'finishedAt', redis.call('TIME')[1])
end

return true 