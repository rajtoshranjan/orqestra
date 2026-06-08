from django.apps import AppConfig


class CloudServicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cloud_services"

    def ready(self):
        # Trigger AWS resource handler registration on startup by importing handlers.
        import cloud_services.providers.aws.account_service.handler  # noqa: F401
        import cloud_services.providers.aws.acm_service.handler  # noqa: F401
        import cloud_services.providers.aws.alb_service.handler  # noqa: F401
        import cloud_services.providers.aws.amazon_mq_service.handler  # noqa: F401
        import cloud_services.providers.aws.api_gateway_service.handler  # noqa: F401
        import cloud_services.providers.aws.app_group_service.handler  # noqa: F401
        import cloud_services.providers.aws.app_runner_service.handler  # noqa: F401
        import cloud_services.providers.aws.appsync_service.handler  # noqa: F401
        import cloud_services.providers.aws.athena_service.handler  # noqa: F401
        import cloud_services.providers.aws.aurora_service.handler  # noqa: F401
        import cloud_services.providers.aws.az_service.handler  # noqa: F401
        import cloud_services.providers.aws.batch_service.handler  # noqa: F401
        import cloud_services.providers.aws.bedrock_service.handler  # noqa: F401
        import cloud_services.providers.aws.cloudfront_service.handler  # noqa: F401
        import cloud_services.providers.aws.cloudtrail_service.handler  # noqa: F401
        import cloud_services.providers.aws.cloudwatch_service.handler  # noqa: F401
        import cloud_services.providers.aws.codebuild_service.handler  # noqa: F401
        import cloud_services.providers.aws.codedeploy_service.handler  # noqa: F401
        import cloud_services.providers.aws.codepipeline_service.handler  # noqa: F401
        import cloud_services.providers.aws.cognito_service.handler  # noqa: F401
        import cloud_services.providers.aws.documentdb_service.handler  # noqa: F401
        import cloud_services.providers.aws.dynamodb_service.handler  # noqa: F401
        import cloud_services.providers.aws.ebs_service.handler  # noqa: F401
        import cloud_services.providers.aws.ec2_service.handler  # noqa: F401
        import cloud_services.providers.aws.ecr_service.handler  # noqa: F401
        import cloud_services.providers.aws.ecs_cluster_service.handler  # noqa: F401
        import cloud_services.providers.aws.efs_service.handler  # noqa: F401
        import cloud_services.providers.aws.eks_cluster_service.handler  # noqa: F401
        import cloud_services.providers.aws.elastic_beanstalk_service.handler  # noqa: F401
        import cloud_services.providers.aws.elasticache_service.handler  # noqa: F401
        import cloud_services.providers.aws.environment_service.handler  # noqa: F401
        import cloud_services.providers.aws.eventbridge_service.handler  # noqa: F401
        import cloud_services.providers.aws.fsx_service.handler  # noqa: F401
        import cloud_services.providers.aws.glue_service.handler  # noqa: F401
        import cloud_services.providers.aws.guardduty_service.handler  # noqa: F401
        import cloud_services.providers.aws.iam_role_service.handler  # noqa: F401
        import cloud_services.providers.aws.internet_gateway_service.handler  # noqa: F401
        import cloud_services.providers.aws.kinesis_service.handler  # noqa: F401
        import cloud_services.providers.aws.kms_service.handler  # noqa: F401
        import cloud_services.providers.aws.lambda_layer_service.handler  # noqa: F401
        import cloud_services.providers.aws.lambda_service.handler  # noqa: F401
        import cloud_services.providers.aws.msk_service.handler  # noqa: F401
        import cloud_services.providers.aws.nat_gateway_service.handler  # noqa: F401
        import cloud_services.providers.aws.neptune_service.handler  # noqa: F401
        import cloud_services.providers.aws.network_acl_service.handler  # noqa: F401
        import cloud_services.providers.aws.nlb_service.handler  # noqa: F401
        import cloud_services.providers.aws.opensearch_service.handler  # noqa: F401
        import cloud_services.providers.aws.rds_service.handler  # noqa: F401
        import cloud_services.providers.aws.redshift_service.handler  # noqa: F401
        import cloud_services.providers.aws.region_service.handler  # noqa: F401
        import cloud_services.providers.aws.route53_service.handler  # noqa: F401
        import cloud_services.providers.aws.route_table_service.handler  # noqa: F401
        import cloud_services.providers.aws.s3_service.handler  # noqa: F401
        import cloud_services.providers.aws.sagemaker_service.handler  # noqa: F401
        import cloud_services.providers.aws.secrets_manager_service.handler  # noqa: F401
        import cloud_services.providers.aws.security_group_service.handler  # noqa: F401
        import cloud_services.providers.aws.ses_service.handler  # noqa: F401
        import cloud_services.providers.aws.shared_services_service.handler  # noqa: F401
        import cloud_services.providers.aws.sns_service.handler  # noqa: F401
        import cloud_services.providers.aws.sqs_service.handler  # noqa: F401
        import cloud_services.providers.aws.ssm_service.handler  # noqa: F401
        import cloud_services.providers.aws.step_function_service.handler  # noqa: F401
        import cloud_services.providers.aws.subnet_service.handler  # noqa: F401
        import cloud_services.providers.aws.transit_gateway_service.handler  # noqa: F401
        import cloud_services.providers.aws.trust_boundary_service.handler  # noqa: F401
        import cloud_services.providers.aws.vpc_endpoint_service.handler  # noqa: F401
        import cloud_services.providers.aws.vpc_service.handler  # noqa: F401
        import cloud_services.providers.aws.waf_service.handler  # noqa: F401
        import cloud_services.providers.aws.xray_service.handler  # noqa: F401
