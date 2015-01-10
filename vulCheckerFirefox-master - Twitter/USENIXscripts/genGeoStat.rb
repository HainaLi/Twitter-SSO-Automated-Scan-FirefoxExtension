if !(ARGV.length == 2)
	p "[usage]: ARGV0: input result file, ARGV1: output csv"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""
quantile = 50

class ClickInfo
	attr_accessor :site, :success, :clickNo, :O_rank, :minClicksNeeded, :fromIframe, :visible, :w, :h, :type, :x, :y, :stringSig, :score, :clickStrategyAndRank, :xPath, :outerHTML, :clickURL, :futile
	def initialize()
		@minClicksNeeded = 999
		@futile = false
	end
end

statRecords = Hash.new
clicks = Array.new
siteURL = ""
fh.each_line{|l|
	l.chomp!
	success = false
	futile = false
	ignore = true
	if (l.start_with? "Testing site:") 
		siteURL = l[14..-1]
		clicks = Hash.new
		statRecords[siteURL] = clicks
		next
	end
	if (l.start_with? "Succeeded:")
		success = true
		l = l[10..-1]
		ignore = false
	elsif (l.start_with? "Failed:")
		success = false
		l = l[7..-1]
		ignore = false
	end
	if (ignore) then next end
	if (l[-7..-1]=="futile,")
		futile = true 
	end
	if (siteURL == "") then next end
	clicks = l.split(';')
	clicks.each_index{|c_i|
		items = clicks[c_i].split(",")
		if (items.length == 1)
			#this means dup or futile, ignore
			next
		end
		xPath = items[-3]
		outerHTML = items[-2]
		url = items[-1]
		key = "#{url}#{xPath}#{outerHTML}#{c_i}"
		if (statRecords[siteURL][key] == nil) then statRecords[siteURL][key] = ClickInfo.new end
		statRecords[siteURL][key].w = items[-8].to_i
		statRecords[siteURL][key].h = items[-7].to_i
		statRecords[siteURL][key].type = items[-6]
		statRecords[siteURL][key].x = items[-5].to_i
		statRecords[siteURL][key].y = items[-4].to_i
		statRecords[siteURL][key].clickURL = url
		statRecords[siteURL][key].xPath = xPath
		statRecords[siteURL][key].outerHTML = outerHTML
		statRecords[siteURL][key].site = siteURL
		statRecords[siteURL][key].success = statRecords[siteURL][key].success || success
		statRecords[siteURL][key].clickNo = c_i+1
		statRecords[siteURL][key].O_rank = items[0]
		if (statRecords[siteURL][key].minClicksNeeded > clicks.length && success)
			statRecords[siteURL][key].minClicksNeeded = clicks.length
		end
		statRecords[siteURL][key].fromIframe = items[1]
		statRecords[siteURL][key].visible = items[2]
		statRecords[siteURL][key].stringSig = items[3].split("|")
		statRecords[siteURL][key].score = items[4]
		statRecords[siteURL][key].clickStrategyAndRank = Array.new
		if (items.length > 10) then statRecords[siteURL][key].clickStrategyAndRank[items[5].split("/")[0].to_i] = items[5].split("/")[1] end
		if (items.length > 11) then statRecords[siteURL][key].clickStrategyAndRank[items[6].split("/")[0].to_i] = items[6].split("/")[1] end
		if (items.length > 12) then statRecords[siteURL][key].clickStrategyAndRank[items[7].split("/")[0].to_i] = items[7].split("/")[1] end
		if (items.length > 13) then statRecords[siteURL][key].clickStrategyAndRank[items[8].split("/")[0].to_i] = items[8].split("/")[1] end
		if (c_i == clicks.length - 2)
			#last click could be futile, previous must not be.
			statRecords[siteURL][key].futile = futile
		end
	}
}

density = Hash.new(0)

widthSuc = Array.new
heightSuc = Array.new
widthFail = Array.new
heightFail = Array.new
statRecords.each_key{|url|
	statRecords[url].each_value{|r|
		if (r.fromIframe == "true") then next end
		if (r.w == 0 || r.h == 0) then next end
		#if (r.clickNo != 2) then next end
		if (r.success)
			widthSuc.push(r.w)
			heightSuc.push(r.h)
		else
			widthFail.push(r.w)
			heightFail.push(r.h)
		end
	}
}

widthSuc.sort!
heightSuc.sort!
widthFail.sort!
heightFail.sort!

output = "\\,"

for i in 1..quantile
	output += (i*100/quantile).to_s + "%,"
end

output += "\nwidthSuc,"

for i in 1..quantile
	output += widthSuc[i*widthSuc.length/quantile - 1].to_s + ","
end

output += "\nwidthFail,"

for i in 1..quantile
	output += widthFail[i*widthFail.length/quantile - 1].to_s + ","
end

output+="\nheightSuc,"

for i in 1..quantile
	output += heightSuc[i*heightSuc.length/quantile - 1].to_s + ","
end

output+="\nheightFail,"

for i in 1..quantile
	output += heightFail[i*heightFail.length/quantile - 1].to_s + ","
end

File.open(ARGV[1],"w"){|f| f.write(output)}
