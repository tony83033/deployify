const {exec} = require('child_process');
const fs = require('fs');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const mime = require('mime-types');
// create a new client of s3

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})

const PROJECT_ID = process.env.PROJECT_ID;
async function init(){
    console.log("Executing script.js to build code");
    const outDirPath = path.join(__dirname, 'output');

    const p = exec(`cd ${outDirPath} && npm run install && npm run build`);
    p.stdout.on('data',function(data){
        console.log(data.toString());
    })

    p.stdout.on('error', function(data){
        console.log("Error", data.toString());
    })

    p.stdout.on('close', async function(data){
        // after completing build process upload dist || output dir to s3
        console.log("Build completed");

        const distDirPath = path.join(__dirname, 'output','dist');
        // No we need to read all the content of dist dir we are using fs module for it
        const distDirContent = fs.readdirSync(distDirPath,{recursive: true}); // it will return an array

        for(const filePath of distDirContent){
            // check if file is directory
            if(filePath.lstatSync().isDirectory()){
                continue;
            }

            const command = new PutObjectCommand({
                Bucket: 'deployify-project',
                Key: `__output/${PROJECT_ID}/${filePath}`,
                Body: fs.createReadStream(filePath),
                //it's hard to determine file type
                ContentType:mime.lookup(filePath)
            });

            // Now send to command to s3
            await S3Client.send(command);


        }
        console.log('Done uploading to s3');
    })
}