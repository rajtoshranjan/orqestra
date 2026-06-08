from cloud_services.registry import registry
from deployments.tofu import build_tofu_config
from orqestra.tests import BaseTestCase


class AllServicesTest(BaseTestCase):
    """
    Unit and integration tests for all 69 registered service handlers,
    with detailed validations, plan building, and OpenTofu compiler tests.
    """

    def test_all_registered_handlers_present(self):
        """Verify that all expected service IDs are correctly registered."""
        expected_services = [
            "account",
            "acm",
            "alb",
            "amazon-mq",
            "api-gateway",
            "app-group",
            "app-runner",
            "appsync",
            "athena",
            "aurora",
            "availability-zone",
            "batch",
            "bedrock",
            "cloudfront",
            "cloudtrail",
            "cloudwatch",
            "codebuild",
            "codedeploy",
            "codepipeline",
            "cognito",
            "documentdb",
            "dynamodb",
            "ebs",
            "ec2",
            "ecr",
            "ecs-cluster",
            "efs",
            "eks-cluster",
            "elastic-beanstalk",
            "elasticache",
            "environment",
            "eventbridge",
            "fsx",
            "glue",
            "guardduty",
            "iam-role",
            "internet-gateway",
            "kinesis",
            "kms",
            "lambda-layer",
            "lambda",
            "msk",
            "nat-gateway",
            "neptune",
            "network-acl",
            "nlb",
            "opensearch",
            "rds",
            "redshift",
            "region",
            "route53",
            "route-table",
            "s3",
            "sagemaker",
            "secrets-manager",
            "security-group",
            "shared-services",
            "sns",
            "sqs",
            "step-function",
            "subnet",
            "transit-gateway",
            "trust-boundary",
            "vpc-endpoint",
            "vpc",
            "waf",
            "xray",
        ]
        for service_id in expected_services:
            self.assertTrue(
                registry.is_registered(service_id),
                f"Service handler '{service_id}' should be registered in backend.",
            )

    def test_new_services_validation_and_plan(self):
        """Test validation and plan building for the 18 newly implemented services."""
        # 1. ACM
        acm_node = {
            "id": "acm-1",
            "type": "acm",
            "data": {
                "service_id": "acm",
                "label": "ACM Certificate",
                "config": {
                    "certificateName": "my-cert",
                    "domainName": "example.com",
                    "validationMethod": "DNS",
                },
            },
        }
        acm_handler = registry.get("acm")
        self.assertEqual(len(acm_handler.validate(acm_node)), 0)
        acm_plan = acm_handler.build_plan_resource(acm_node, 0)
        self.assertEqual(acm_plan["name"], "my-cert")

        # ACM Invalid
        invalid_acm = {
            "id": "acm-1",
            "type": "acm",
            "data": {"service_id": "acm", "config": {}},
        }
        self.assertGreater(len(acm_handler.validate(invalid_acm)), 0)

        # 2. AppSync
        appsync_node = {
            "id": "appsync-1",
            "type": "appsync",
            "data": {
                "service_id": "appsync",
                "label": "AppSync API",
                "config": {
                    "apiName": "my-api",
                    "authenticationType": "API_KEY",
                    "apiType": "GRAPHQL",
                },
            },
        }
        appsync_handler = registry.get("appsync")
        self.assertEqual(len(appsync_handler.validate(appsync_node)), 0)
        appsync_plan = appsync_handler.build_plan_resource(appsync_node, 1)
        self.assertEqual(appsync_plan["name"], "my-api")

        # 3. Athena
        athena_node = {
            "id": "athena-1",
            "type": "athena",
            "data": {
                "service_id": "athena",
                "label": "Athena Workgroup",
                "config": {
                    "workGroupName": "my-workgroup",
                    "outputLocation": "s3://results/",
                    "engineVersion": "AUTO",
                },
            },
        }
        athena_handler = registry.get("athena")
        self.assertEqual(len(athena_handler.validate(athena_node)), 0)
        athena_plan = athena_handler.build_plan_resource(athena_node, 0)
        self.assertEqual(athena_plan["name"], "my-workgroup")

        # 4. Bedrock
        bedrock_node = {
            "id": "bedrock-1",
            "type": "bedrock",
            "data": {
                "service_id": "bedrock",
                "label": "Bedrock Agent",
                "config": {
                    "agentName": "my-agent",
                    "foundationModel": "claude-3-sonnet",
                    "guardrailMode": "NONE",
                },
            },
        }
        bedrock_handler = registry.get("bedrock")
        self.assertEqual(len(bedrock_handler.validate(bedrock_node)), 0)

        # 5. CloudFront
        cloudfront_node = {
            "id": "cf-1",
            "type": "cloudfront",
            "data": {
                "service_id": "cloudfront",
                "label": "CloudFront Distribution",
                "config": {
                    "distributionName": "my-dist",
                    "priceClass": "PriceClass_100",
                    "viewerProtocolPolicy": "redirect-to-https",
                },
            },
        }
        cloudfront_handler = registry.get("cloudfront")
        self.assertEqual(len(cloudfront_handler.validate(cloudfront_node)), 0)

        # 6. CloudTrail
        cloudtrail_node = {
            "id": "trail-1",
            "type": "cloudtrail",
            "data": {
                "service_id": "cloudtrail",
                "label": "CloudTrail",
                "config": {
                    "trailName": "my-trail",
                    "destinationBucketName": "logs-bucket",
                    "managementEvents": "All",
                },
            },
        }
        cloudtrail_handler = registry.get("cloudtrail")
        self.assertEqual(len(cloudtrail_handler.validate(cloudtrail_node)), 0)

        # 7. DocumentDB
        docdb_node = {
            "id": "docdb-1",
            "type": "documentdb",
            "data": {
                "service_id": "documentdb",
                "label": "DocumentDB",
                "config": {
                    "clusterIdentifier": "my-docdb",
                    "engineVersion": "5.0.0",
                    "instanceClass": "db.t3.medium",
                },
            },
        }
        docdb_handler = registry.get("documentdb")
        self.assertEqual(len(docdb_handler.validate(docdb_node)), 0)

        # 8. Glue
        glue_node = {
            "id": "glue-1",
            "type": "glue",
            "data": {
                "service_id": "glue",
                "label": "Glue",
                "config": {
                    "databaseName": "my-glue-db",
                    "crawlerName": "my-crawler",
                    "dataSourceType": "S3",
                },
            },
        }
        glue_handler = registry.get("glue")
        self.assertEqual(len(glue_handler.validate(glue_node)), 0)

        # 9. GuardDuty
        guardduty_node = {
            "id": "gd-1",
            "type": "guardduty",
            "data": {
                "service_id": "guardduty",
                "label": "GuardDuty",
                "config": {
                    "detectorName": "my-detector",
                    "findingPublishingFrequency": "SIX_HOURS",
                },
            },
        }
        guardduty_handler = registry.get("guardduty")
        self.assertEqual(len(guardduty_handler.validate(guardduty_node)), 0)

        # 10. MSK
        msk_node = {
            "id": "msk-1",
            "type": "msk",
            "data": {
                "service_id": "msk",
                "label": "MSK",
                "config": {
                    "clusterName": "my-msk",
                    "kafkaVersion": "3.6.0",
                    "brokerInstanceType": "kafka.t3.small",
                    "brokerCount": 3,
                },
            },
        }
        msk_handler = registry.get("msk")
        self.assertEqual(len(msk_handler.validate(msk_node)), 0)

        # 11. Neptune
        neptune_node = {
            "id": "neptune-1",
            "type": "neptune",
            "data": {
                "service_id": "neptune",
                "label": "Neptune",
                "config": {
                    "clusterIdentifier": "my-neptune",
                    "engineVersion": "1.3.2.0",
                    "instanceClass": "db.t3.medium",
                },
            },
        }
        neptune_handler = registry.get("neptune")
        self.assertEqual(len(neptune_handler.validate(neptune_node)), 0)

        # 12. NLB
        nlb_node = {
            "id": "nlb-1",
            "type": "nlb",
            "data": {
                "service_id": "nlb",
                "label": "NLB",
                "config": {
                    "loadBalancerName": "my-nlb",
                    "scheme": "internal",
                    "ipAddressType": "ipv4",
                },
            },
        }
        nlb_handler = registry.get("nlb")
        self.assertEqual(len(nlb_handler.validate(nlb_node)), 0)

        # 13. OpenSearch
        opensearch_node = {
            "id": "os-1",
            "type": "opensearch",
            "data": {
                "service_id": "opensearch",
                "label": "OpenSearch",
                "config": {
                    "domainName": "my-search",
                    "engineVersion": "OpenSearch_2.11",
                    "instanceType": "t3.small.search",
                },
            },
        }
        opensearch_handler = registry.get("opensearch")
        self.assertEqual(len(opensearch_handler.validate(opensearch_node)), 0)

        # 14. SageMaker
        sagemaker_node = {
            "id": "sm-1",
            "type": "sagemaker",
            "data": {
                "service_id": "sagemaker",
                "label": "SageMaker",
                "config": {
                    "notebookName": "my-notebook",
                    "instanceType": "ml.t3.medium",
                    "volumeSizeGb": 20,
                },
            },
        }
        sagemaker_handler = registry.get("sagemaker")
        self.assertEqual(len(sagemaker_handler.validate(sagemaker_node)), 0)

        # 15. SES
        ses_node = {
            "id": "ses-1",
            "type": "ses",
            "data": {
                "service_id": "ses",
                "label": "SES",
                "config": {
                    "identityName": "example.com",
                    "identityType": "Domain",
                    "mailFromDomain": "mail.example.com",
                },
            },
        }
        ses_handler = registry.get("ses")
        self.assertEqual(len(ses_handler.validate(ses_node)), 0)

        # 16. SSM
        ssm_node = {
            "id": "ssm-1",
            "type": "ssm",
            "data": {
                "service_id": "ssm",
                "label": "SSM Parameter",
                "config": {
                    "parameterName": "/app/config",
                    "parameterType": "String",
                    "tier": "Standard",
                },
            },
        }
        ssm_handler = registry.get("ssm")
        self.assertEqual(len(ssm_handler.validate(ssm_node)), 0)

        # 17. VPC Endpoint
        vpce_node = {
            "id": "vpce-1",
            "type": "vpc-endpoint",
            "data": {
                "service_id": "vpc-endpoint",
                "label": "VPC Endpoint",
                "config": {
                    "endpointName": "my-endpoint",
                    "endpointType": "Interface",
                    "serviceName": "com.amazonaws.us-east-1.s3",
                },
            },
        }
        vpce_handler = registry.get("vpc-endpoint")
        self.assertEqual(len(vpce_handler.validate(vpce_node)), 0)

        # 18. WAF
        waf_node = {
            "id": "waf-1",
            "type": "waf",
            "data": {
                "service_id": "waf",
                "label": "WAF",
                "config": {
                    "webAclName": "my-waf",
                    "scope": "REGIONAL",
                    "defaultAction": "ALLOW",
                },
            },
        }
        waf_handler = registry.get("waf")
        self.assertEqual(len(waf_handler.validate(waf_node)), 0)

    def test_new_services_tofu_compilation(self):
        """Verify Terraform configuration generation for all 18 new services."""
        nodes = [
            # ACM
            {
                "id": "acm-1",
                "data": {
                    "service_id": "acm",
                    "config": {
                        "certificateName": "cert",
                        "domainName": "domain.com",
                        "validationMethod": "DNS",
                    },
                },
            },
            # AppSync
            {
                "id": "appsync-1",
                "data": {
                    "service_id": "appsync",
                    "config": {"apiName": "api", "authenticationType": "API_KEY"},
                },
            },
            # Athena
            {
                "id": "athena-1",
                "data": {
                    "service_id": "athena",
                    "config": {"workGroupName": "wg", "outputLocation": "s3://output/"},
                },
            },
            # Bedrock
            {
                "id": "bedrock-1",
                "data": {
                    "service_id": "bedrock",
                    "config": {"agentName": "agent", "foundationModel": "model"},
                },
            },
            # CloudFront
            {
                "id": "cloudfront-1",
                "data": {
                    "service_id": "cloudfront",
                    "config": {
                        "distributionName": "dist",
                        "priceClass": "PriceClass_100",
                        "viewerProtocolPolicy": "allow-all",
                    },
                },
            },
            # CloudTrail
            {
                "id": "cloudtrail-1",
                "data": {
                    "service_id": "cloudtrail",
                    "config": {"trailName": "trail", "destinationBucketName": "bucket"},
                },
            },
            # DocumentDB
            {
                "id": "docdb-1",
                "data": {
                    "service_id": "documentdb",
                    "config": {
                        "clusterIdentifier": "docdb",
                        "engineVersion": "5.0.0",
                        "instanceClass": "db.t3.medium",
                    },
                },
            },
            # Glue
            {
                "id": "glue-1",
                "data": {
                    "service_id": "glue",
                    "config": {
                        "databaseName": "database",
                        "crawlerName": "crawler",
                        "dataSourceType": "S3",
                    },
                },
            },
            # GuardDuty
            {
                "id": "guardduty-1",
                "data": {
                    "service_id": "guardduty",
                    "config": {
                        "detectorName": "detector",
                        "findingPublishingFrequency": "ONE_HOUR",
                    },
                },
            },
            # MSK
            {
                "id": "msk-1",
                "data": {
                    "service_id": "msk",
                    "config": {
                        "clusterName": "msk",
                        "kafkaVersion": "3.6.0",
                        "brokerInstanceType": "kafka.t3.small",
                        "brokerCount": 3,
                    },
                },
            },
            # Neptune
            {
                "id": "neptune-1",
                "data": {
                    "service_id": "neptune",
                    "config": {
                        "clusterIdentifier": "neptune",
                        "engineVersion": "1.3.2.0",
                        "instanceClass": "db.t3.medium",
                    },
                },
            },
            # NLB
            {
                "id": "nlb-1",
                "data": {
                    "service_id": "nlb",
                    "config": {
                        "loadBalancerName": "nlb",
                        "scheme": "internet-facing",
                        "ipAddressType": "ipv4",
                    },
                },
            },
            # OpenSearch
            {
                "id": "opensearch-1",
                "data": {
                    "service_id": "opensearch",
                    "config": {
                        "domainName": "os",
                        "engineVersion": "1.0",
                        "instanceType": "t3.small.search",
                    },
                },
            },
            # SageMaker
            {
                "id": "sagemaker-1",
                "data": {
                    "service_id": "sagemaker",
                    "config": {
                        "notebookName": "sm",
                        "instanceType": "ml.t3.medium",
                        "volumeSizeGb": 20,
                    },
                },
            },
            # SES
            {
                "id": "ses-1",
                "data": {
                    "service_id": "ses",
                    "config": {
                        "identityName": "ses",
                        "identityType": "EmailAddress",
                        "mailFromDomain": "mail",
                    },
                },
            },
            # SSM
            {
                "id": "ssm-1",
                "data": {
                    "service_id": "ssm",
                    "config": {
                        "parameterName": "ssm",
                        "parameterType": "String",
                        "tier": "Standard",
                    },
                },
            },
            # VPC Endpoint
            {
                "id": "vpce-1",
                "data": {
                    "service_id": "vpc-endpoint",
                    "config": {
                        "endpointName": "vpce",
                        "endpointType": "Interface",
                        "serviceName": "s3",
                    },
                },
            },
            # WAF
            {
                "id": "waf-1",
                "data": {
                    "service_id": "waf",
                    "config": {
                        "webAclName": "waf",
                        "scope": "REGIONAL",
                        "defaultAction": "BLOCK",
                    },
                },
            },
        ]

        edges = []
        settings = {"region": "us-east-1"}

        tofu_config = build_tofu_config(nodes, edges, settings)
        self.assertIn("resource", tofu_config)
        resources = tofu_config["resource"]

        # Assert each of the resource type allocations exists in generated tofu config
        self.assertIn("aws_acm_certificate", resources)
        self.assertIn("aws_appsync_graphql_api", resources)
        self.assertIn("aws_athena_workgroup", resources)
        self.assertIn("aws_bedrockagent_agent", resources)
        self.assertIn("aws_cloudfront_distribution", resources)
        self.assertIn("aws_cloudtrail", resources)
        self.assertIn("aws_docdb_cluster", resources)
        self.assertIn("aws_docdb_cluster_instance", resources)
        self.assertIn("aws_glue_catalog_database", resources)
        self.assertIn("aws_glue_crawler", resources)
        self.assertIn("aws_guardduty_detector", resources)
        self.assertIn("aws_msk_cluster", resources)
        self.assertIn("aws_neptune_cluster", resources)
        self.assertIn("aws_neptune_cluster_instance", resources)
        self.assertIn("aws_lb", resources)
        self.assertIn("aws_opensearch_domain", resources)
        self.assertIn("aws_sagemaker_notebook_instance", resources)
        self.assertIn("aws_ses_email_identity", resources)
        self.assertIn("aws_ssm_parameter", resources)
        self.assertIn("aws_vpc_endpoint", resources)
        self.assertIn("aws_wafv2_web_acl", resources)

    def test_cloudfront_with_resolved_s3_origin(self):
        """Test that CloudFront correctly resolves a connected S3 node as its origin."""
        nodes = [
            {
                "id": "cf-1",
                "data": {
                    "service_id": "cloudfront",
                    "config": {
                        "distributionName": "dist",
                        "priceClass": "PriceClass_100",
                        "viewerProtocolPolicy": "redirect-to-https",
                    },
                },
            },
            {
                "id": "s3-bucket",
                "data": {
                    "service_id": "s3",
                    "config": {"bucket_name": "my-data-bucket"},
                },
            },
        ]
        edges = [{"id": "e1", "source": "cf-1", "target": "s3-bucket"}]
        tofu_config = build_tofu_config(nodes, edges, {"region": "us-east-1"})
        cf_dist = tofu_config["resource"]["aws_cloudfront_distribution"]["cf_1"]
        self.assertEqual(len(cf_dist["origin"]), 1)
        self.assertEqual(
            cf_dist["origin"][0]["domain_name"],
            "${aws_s3_bucket.s3_bucket.bucket_regional_domain_name}",
        )
        self.assertEqual(cf_dist["origin"][0]["origin_id"], "s3_bucket")
