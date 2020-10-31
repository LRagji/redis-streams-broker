--Creates a group by the name and options provided, if the stream doesnot exists then it is created this operation has to be atomic so needs a lua script
--Creates Stream is not exists with groupname provided Reponse: =1
--Creates group if stream already present: Response =1
--Does nothing when the same group name already exists: Response =nil

local channel_name = KEYS[1]
local group_name = ARGV[1]
local read_from = ARGV[2]

if redis.call("EXISTS",channel_name) == 0 then 
    pcall(function() redis.call("XGROUP","CREATE",channel_name,group_name,read_from,"MKSTREAM") end)
end

return pcall(function() redis.call("XGROUP","CREATE",channel_name,group_name,read_from) end)