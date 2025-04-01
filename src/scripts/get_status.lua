-- get_status.lua
-- Gets the status of a job
-- ARGV[1]: Job ID

local job_id = ARGV[1]

-- Create the job key
local job_key = 'qtask:job:' .. job_id

-- Check if the job exists
if redis.call('EXISTS', job_key) == 0 then
  return nil
end

-- Get the job status
local status = redis.call('HGET', job_key, 'status')

return status 