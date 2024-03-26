const {exec} = require('child_process');
const fs = require('fs');
const path = require('path');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const Redis = require('ioredis');



const redis = new Redis('rediss://default:AVNS_omCddpi9Pkp3uTnAcel@redis-deployify-tonystark83033-c11f.a.aivencloud.com:23302');


// create a new client of s3

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIAU6GDWNLEQECIJW2F',
        secretAccessKey: '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'
    }
})

const PROJECT_ID = process.env.PROJECT_ID;

function publishLogs(log){
    redis.publish(`logs:${PROJECT_ID}`,JSON.stringify({log}));
}
async function init(){
    console.log("Executing script.js to build code");
    publishLogs('Projec Build started...');
    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);
    p.stdout.on('data',function(data){
        console.log(data.toString());
        publishLogs(data.toString());
    })

    p.stdout.on('error', function(data){
        console.log("Error", data.toString());
        publishLogs(`Error: ${data.toString()}`);
    })

    p.stdout.on('close', async function(){
        // after completing build process upload dist || output dir to s3
        console.log("Build completed");
        publishLogs('Build Completed');

        const distDirPath = path.join(__dirname, 'output','dist');
        // No we need to read all the content of dist dir we are using fs module for it
        const distDirContent = fs.readdirSync(distDirPath, {recursive: true}); // it will return an array
        publishLogs("Starting upload to s3");
        for(const file of distDirContent){
            const filePath = path.join(distDirPath, file);
            // check if file is directory
            if(fs.lstatSync(filePath).isDirectory()){
                continue;
            }

            console.log("uploading...",filePath);
            publishLogs(`Uploading ${file} to s3`);
            const command = new PutObjectCommand({
                Bucket: 'deployify-project',
                Key: `__output/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                //it's hard to determine file type
                ContentType:mime.lookup(filePath)
            });

            // Now send to command to s3
            await s3Client.send(command);
            console.log("uploaded",filePath);
            publishLogs(`Uploaded ${file} to s3`);

        }
        console.log('Done uploading to s3');
        publishLogs('Done uploading to s3');
    })
}

init();