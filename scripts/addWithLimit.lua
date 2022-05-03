local function slice(tbl, startIndex, stopIndex)
    local sliced = {}
    for i = startIndex, stopIndex, 1 do
        sliced[#sliced + 1] = tbl[i]
    end
    return sliced
end

local limit = tonumber(ARGV[1])
local streamKeyName = KEYS[1]
local payload = slice(ARGV, 2, #ARGV)

local currentCount = redis.call('XLEN', streamKeyName)
if (currentCount >= limit) then
    return nil
else
    return redis.call('XADD', streamKeyName, '*', unpack(payload))
end
