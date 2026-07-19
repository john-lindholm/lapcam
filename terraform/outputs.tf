output "server_public_ip" {
  description = "Public IP address of the LapCam server"
  value       = aws_eip.lapcam_server.public_ip
}

output "server_url" {
  description = "URL to access the LapCam web UI"
  value       = "https://${var.domain}"
}

output "s3_bucket_name" {
  description = "S3 bucket name for recordings"
  value       = aws_s3_bucket.recordings.bucket
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${var.key_name}.pem ubuntu@${aws_eip.lapcam_server.public_ip}"
}
